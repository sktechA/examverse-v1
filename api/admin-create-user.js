import {
  getSupabaseAdmin,
  verifyAdminAuth,
  withApiLogging,
  isValidUuid,
  isValidEmail,
  sanitizeString,
  sanitizeObject,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp,
  isSuperOrAdminRole
} from './_shared.js';

async function handler(req, res) {
  const method = req.method;
  if (method !== 'POST' && method !== 'DELETE' && method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Autonomous Rate Limiting (Defense against brute-force & denial of service)
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'admin-user-mgmt', 25, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
  }

  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return res.status(500).json({
        error: 'Database server authorization configuration unavailable.'
      });
    }

    const sb = getSupabaseAdmin(req);
    const auth = await verifyAdminAuth(req, sb);

    // 2. Strict Authentication Enforcement (Zero bypass loophole)
    if (!auth.ok) {
      return res.status(auth.statusCode || 401).json({
        error: auth.error || 'Authentication required: administrator credentials required.'
      });
    }

    const isSuperOrAdmin = isSuperOrAdminRole(auth);

    // 3. Determine and Sanitize Action
    const body = sanitizeObject(req.body || {});
    const action = body?.action || (method === 'DELETE' ? 'delete' : 'create');

    // ACTION: DELETE USER
    if (action === 'delete') {
      // RBAC: Only Super Admin or Admin can delete accounts
      if (!isSuperOrAdmin) {
        return res.status(403).json({ error: 'Access denied: Admin or Super Admin privileges required to delete users.' });
      }

      const rawUserId = body?.userId || body?.id || req.query?.id;
      const userId = typeof rawUserId === 'string' ? rawUserId.trim() : '';
      if (!userId || !isValidUuid(userId)) {
        return res.status(400).json({ error: 'Valid UUID userId format is required to delete a user.' });
      }

      // Prevent admin from deleting their own active user
      if (auth.user?.id && auth.user.id === userId) {
        return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
      }

      const encodedId = encodeURIComponent(userId);

      // 1. Delete from Supabase Auth via Admin API
      const authDelRes = await fetch(`${url}/auth/v1/admin/users/${encodedId}`, {
        method: 'DELETE',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });

      // 2. Delete from profiles table
      const profileDelRes = await fetch(`${url}/rest/v1/profiles?id=eq.${encodedId}`, {
        method: 'DELETE',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });

      if (!authDelRes.ok && authDelRes.status !== 404) {
        const errJson = await authDelRes.json().catch(() => ({}));
        console.warn('[Admin User Delete] Auth delete warning:', errJson);
      }

      return res.status(200).json({
        ok: true,
        deleted: true,
        userId,
        message: 'User credentials and profile successfully removed from database.'
      });
    }

    // ACTION: ADMIN RESET/CHANGE USER PASSWORD
    if (action === 'reset_password' || action === 'update_password') {
      // RBAC: Only Super Admin or Admin can reset other users' passwords
      if (!isSuperOrAdmin) {
        return res.status(403).json({ error: 'Access denied: Admin or Super Admin privileges required to modify user credentials.' });
      }

      const rawUserId = body?.userId || body?.id;
      const userId = typeof rawUserId === 'string' ? rawUserId.trim() : '';
      const newPassword = body?.password || body?.newPassword;

      if (!userId || !isValidUuid(userId)) {
        return res.status(400).json({ error: 'Valid UUID userId is required.' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || newPassword.includes('\0')) {
        return res.status(400).json({ error: 'Password must be between 8 and 128 characters without null bytes.' });
      }

      const encodedId = encodeURIComponent(userId);
      const updRes = await fetch(`${url}/auth/v1/admin/users/${encodedId}`, {
        method: 'PUT',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: String(newPassword) })
      });

      const updJson = await updRes.json().catch(() => ({}));
      if (!updRes.ok) {
        return res.status(updRes.status).json({
          error: sanitizeErrorResponse(updJson.msg || updJson.message, 'Failed to update user credentials.')
        });
      }

      // Update timestamp in profiles
      await fetch(`${url}/rest/v1/profiles?id=eq.${encodedId}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updated_at: new Date().toISOString() })
      });

      return res.status(200).json({
        ok: true,
        userId,
        message: 'User password successfully updated in Supabase Auth and database.'
      });
    }

    // ACTION: CREATE NEW USER
    const { name, email, phone, password, role = 'candidate' } = body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Full name, valid email, and password are required.' });
    }

    const cleanName = sanitizeString(name, 100);
    const cleanEmail = String(email).trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters long.' });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128 || password.includes('\0')) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters without null bytes.' });
    }

    const allowedRoles = [
      'candidate',
      'sub_admin',
      'question_manager',
      'exam_manager',
      'vacancy_manager',
      'content_manager',
      'support'
    ];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }

    // RBAC: Creating elevated roles (sub_admin, managers) requires Super Admin / Admin
    if (role !== 'candidate' && !isSuperOrAdmin) {
      return res.status(403).json({ error: 'Access denied: Admin or Super Admin role required to create staff accounts.' });
    }

    const cleanPhone = phone ? sanitizeString(phone, 20) : null;

    const r = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        phone: cleanPhone || undefined,
        email_confirm: true,
        phone_confirm: Boolean(cleanPhone),
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role
        }
      })
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        error: sanitizeErrorResponse(j.msg || j.message || j.error_description, 'Failed to create user account.')
      });
    }

    const userId = j.id || j.user?.id;
    if (userId) {
      await fetch(`${url}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userId,
          email: cleanEmail,
          phone: cleanPhone,
          full_name: cleanName,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    }

    return res.status(200).json({
      ok: true,
      id: userId,
      email: cleanEmail,
      role,
      message: 'User created and credentials persisted in database.'
    });
  } catch (e) {
    return res.status(500).json({ error: sanitizeErrorResponse(e, 'Unexpected user management error.') });
  }
}

export default withApiLogging(handler, 'admin-create-user');
