-- SKTECH EXAM PORTAL V7 baseline schema
-- Run this in Supabase SQL Editor before using real data features.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  state text,
  preferred_exams text[] default '{}',
  role text not null default 'candidate' check (role in ('candidate','question_manager','exam_manager','vacancy_manager','content_manager','support','super_admin')),
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  option_a text, option_b text, option_c text, option_d text,
  correct_answer text,
  explanation text,
  question_hi text,
  option_a_hi text, option_b_hi text, option_c_hi text, option_d_hi text,
  subject text, topic text, subtopic text, difficulty text,
  language text default 'English', exam text, year int, source text,
  tags text[] default '{}', status text not null default 'pending' check (status in ('pending','approved','rejected','draft')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.question_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null, file_type text, question_count int default 0,
  status text not null default 'processing',
  uploaded_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(), title text not null, exam_name text, sections jsonb default '[]',
  question_count int default 0, duration_minutes int default 60, max_marks numeric default 0,
  negative_mark numeric default 0, randomize boolean default true, status text default 'draft',
  schedule_start timestamptz, schedule_end timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(), exam_id uuid references public.exams(id) on delete set null,
  candidate_id uuid references auth.users(id) on delete cascade, answers jsonb default '{}',
  score numeric default 0, correct_count int default 0, wrong_count int default 0, skipped_count int default 0,
  started_at timestamptz, submitted_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.page_events (
  id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete set null,
  event_name text not null, path text, metadata jsonb default '{}', created_at timestamptz not null default now()
);

create table if not exists public.vacancies (
  id uuid primary key default gen_random_uuid(), board text not null, title text not null, last_date date,
  notification_url text, apply_url text, status text default 'draft', featured boolean default false,
  source_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), title text not null, message text not null,
  audience text default 'all', channel text[] default '{in_app}', scheduled_at timestamptz,
  published boolean default false, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

-- Bootstrap a Super Admin after creating the Auth user. Replace the email below locally.
-- insert into public.profiles(id,email,role) select id,email,'super_admin' from auth.users where email='YOUR_ADMIN_EMAIL' on conflict(id) do update set role='super_admin';

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.question_imports enable row level security;
alter table public.exams enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.page_events enable row level security;
alter table public.vacancies enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support'));
$$;

-- Candidate can read/update own profile; admins can manage operational data.
create policy if not exists profiles_self on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy if not exists profiles_update_self on public.profiles for update using (id=auth.uid() or public.is_admin());
create policy if not exists questions_read_approved on public.questions for select using (status='approved' or public.is_admin());
create policy if not exists questions_admin_all on public.questions for all using (public.is_admin()) with check (public.is_admin());
create policy if not exists imports_admin_all on public.question_imports for all using (public.is_admin()) with check (public.is_admin());
create policy if not exists exams_read_published on public.exams for select using (status='published' or public.is_admin());
create policy if not exists exams_admin_all on public.exams for all using (public.is_admin()) with check (public.is_admin());
create policy if not exists attempts_self on public.exam_attempts for select using (candidate_id=auth.uid() or public.is_admin());
create policy if not exists attempts_insert_self on public.exam_attempts for insert with check (candidate_id=auth.uid());
create policy if not exists attempts_admin on public.exam_attempts for update using (public.is_admin());
create policy if not exists events_self_insert on public.page_events for insert with check (user_id=auth.uid() or user_id is null);
create policy if not exists events_admin_read on public.page_events for select using (public.is_admin());
create policy if not exists vacancies_read_published on public.vacancies for select using (status='published' or public.is_admin());
create policy if not exists vacancies_admin_all on public.vacancies for all using (public.is_admin()) with check (public.is_admin());
create policy if not exists notifications_read on public.notifications for select using (published=true or public.is_admin());
create policy if not exists notifications_admin_all on public.notifications for all using (public.is_admin()) with check (public.is_admin());


-- V7 SAMPLE QUESTION DATA (safe demo seed; review/edit before production use)
-- 20 approved + 10 pending questions for testing the Admin Review Queue.
insert into public.questions
(question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,subject,topic,subtopic,difficulty,language,exam,year,source,status)
values
('If 25% of a number is 45, what is the number?','120','150','180','200','C','45 ÷ 0.25 = 180.','यदि किसी संख्या का 25% 45 है, तो संख्या क्या है?','120','150','180','200','Mathematics','Percentage','Basic Percentage','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('A train travels 360 km in 4.5 hours. What is its average speed?','70 km/h','80 km/h','90 km/h','100 km/h','B','Speed = 360 ÷ 4.5 = 80 km/h.','एक ट्रेन 4.5 घंटे में 360 किमी चलती है। औसत गति क्या है?','70 किमी/घं','80 किमी/घं','90 किमी/घं','100 किमी/घं','Mathematics','Time Speed Distance','Average Speed','Easy','English + Hindi','RRB NTPC',2026,'SKTech Sample','approved'),
('Find the next number: 3, 6, 12, 24, ?','36','42','48','54','C','Each term is multiplied by 2.','अगली संख्या ज्ञात कीजिए: 3, 6, 12, 24, ?','36','42','48','54','Reasoning','Number Series','Multiplication Pattern','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('If CAT is coded as DBU, how is DOG coded using the same pattern?','EPH','EOG','FPH','DPE','A','Each letter moves one step forward.','यदि CAT को DBU लिखा जाता है, तो उसी पैटर्न में DOG कैसे लिखा जाएगा?','EPH','EOG','FPH','DPE','Reasoning','Coding Decoding','Letter Coding','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('Which Article of the Constitution guarantees equality before law?','Article 12','Article 14','Article 19','Article 21','B','Article 14 provides equality before law and equal protection of laws.','संविधान का कौन-सा अनुच्छेद कानून के समक्ष समानता की गारंटी देता है?','अनुच्छेद 12','अनुच्छेद 14','अनुच्छेद 19','अनुच्छेद 21','Indian Polity','Fundamental Rights','Right to Equality','Easy','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('The Constitution of India came into force on:','15 August 1947','26 November 1949','26 January 1950','2 October 1950','C','The Constitution came into force on 26 January 1950.','भारत का संविधान कब लागू हुआ?','15 अगस्त 1947','26 नवंबर 1949','26 जनवरी 1950','2 अक्टूबर 1950','Indian Constitution','Constitution Basics','Commencement','Easy','English + Hindi','MPPSC',2026,'SKTech Sample','approved'),
('Who is known as the Father of the Indian Constitution?','Mahatma Gandhi','Jawaharlal Nehru','B. R. Ambedkar','Rajendra Prasad','C','Dr. B. R. Ambedkar chaired the Drafting Committee and is widely known by this title.','भारतीय संविधान के जनक के रूप में किसे जाना जाता है?','महात्मा गांधी','जवाहरलाल नेहरू','बी. आर. आंबेडकर','राजेंद्र प्रसाद','Indian History','Modern India','Constitution Making','Easy','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('The Battle of Plassey was fought in:','1757','1761','1764','1857','A','The Battle of Plassey was fought in 1757.','प्लासी का युद्ध कब लड़ा गया था?','1757','1761','1764','1857','Indian History','Modern India','British Expansion','Easy','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('Which river is known as the Sorrow of Bihar?','Ganga','Kosi','Narmada','Godavari','B','The Kosi is often called the Sorrow of Bihar because of frequent flooding.','किस नदी को बिहार का शोक कहा जाता है?','गंगा','कोसी','नर्मदा','गोदावरी','Indian Geography','Rivers','Indian Rivers','Easy','English + Hindi','MPPSC',2026,'SKTech Sample','approved'),
('The Tropic of Cancer passes through how many Indian states?','6','7','8','9','C','The Tropic of Cancer passes through 8 Indian states.','कर्क रेखा भारत के कितने राज्यों से होकर गुजरती है?','6','7','8','9','Indian Geography','Physical Geography','Latitude','Moderate','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('Repo rate is decided by which institution in India?','SEBI','RBI','NITI Aayog','Finance Commission','B','The Reserve Bank of India sets the policy repo rate through its monetary policy process.','भारत में रेपो रेट किस संस्था द्वारा निर्धारित किया जाता है?','SEBI','RBI','नीति आयोग','वित्त आयोग','Banking Awareness','Monetary Policy','Repo Rate','Easy','English + Hindi','Banking/RRB',2026,'SKTech Sample','approved'),
('What does GDP stand for?','Gross Domestic Product','General Development Plan','Gross Development Price','Government Domestic Production','A','GDP means Gross Domestic Product.','GDP का पूर्ण रूप क्या है?','सकल घरेलू उत्पाद','सामान्य विकास योजना','सकल विकास मूल्य','सरकारी घरेलू उत्पादन','Indian Economy','National Income','GDP','Easy','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('Which gas is most abundant in Earth’s atmosphere?','Oxygen','Nitrogen','Carbon dioxide','Hydrogen','B','Nitrogen makes up about 78% of Earth’s atmosphere.','पृथ्वी के वायुमंडल में सबसे अधिक कौन-सी गैस है?','ऑक्सीजन','नाइट्रोजन','कार्बन डाइऑक्साइड','हाइड्रोजन','General Science','Environment','Atmosphere','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('The SI unit of electric resistance is:','Volt','Ampere','Ohm','Watt','C','The SI unit of resistance is the ohm.','विद्युत प्रतिरोध की SI इकाई क्या है?','वोल्ट','एम्पियर','ओम','वाट','Electrical Engineering','Basic Electrical','Resistance','Easy','English + Hindi','MP Sub Engineer',2026,'SKTech Sample','approved'),
('In a DC circuit, Ohm’s law is expressed as:','P=VI','V=IR','Q=It','E=mc²','B','Ohm’s law states V = IR.','DC परिपथ में ओम का नियम किस रूप में व्यक्त किया जाता है?','P=VI','V=IR','Q=It','E=mc²','Electrical Engineering','Circuit Theory','Ohms Law','Easy','English + Hindi','MP Sub Engineer',2026,'SKTech Sample','approved'),
('Which component is commonly used to store electrical energy in an electric field?','Resistor','Capacitor','Inductor','Diode','B','A capacitor stores energy in an electric field.','विद्युत क्षेत्र में ऊर्जा संग्रहित करने के लिए सामान्यतः किस घटक का उपयोग होता है?','रेसिस्टर','कैपेसिटर','इंडक्टर','डायोड','Electronics Engineering','Electronic Components','Capacitor','Easy','English + Hindi','MP Sub Engineer',2026,'SKTech Sample','approved'),
('Which material is commonly used for high-strength concrete reinforcement?','Glass','Steel','Wood','Rubber','B','Steel reinforcement provides tensile strength in reinforced concrete.','उच्च-शक्ति कंक्रीट में सुदृढ़ीकरण के लिए सामान्यतः किस पदार्थ का उपयोग होता है?','कांच','स्टील','लकड़ी','रबर','Civil Engineering','Construction Materials','Reinforcement','Easy','English + Hindi','MP Sub Engineer',2026,'SKTech Sample','approved'),
('In a four-stroke engine, one complete cycle requires how many crankshaft revolutions?','One','Two','Three','Four','B','A four-stroke cycle requires two crankshaft revolutions.','चार-स्ट्रोक इंजन में एक पूर्ण चक्र के लिए क्रैंकशाफ्ट के कितने चक्कर आवश्यक हैं?','एक','दो','तीन','चार','Mechanical Engineering','IC Engine','Four Stroke Cycle','Easy','English + Hindi','MP Sub Engineer',2026,'SKTech Sample','approved'),
('Which soil is generally best known for cotton cultivation in India?','Alluvial soil','Black soil','Laterite soil','Desert soil','B','Black soil has high moisture retention and is traditionally associated with cotton cultivation.','भारत में कपास की खेती के लिए कौन-सी मिट्टी प्रसिद्ध है?','जलोढ़ मिट्टी','काली मिट्टी','लेटराइट मिट्टी','मरुस्थलीय मिट्टी','Indian Geography','Soils','Black Soil','Easy','English + Hindi','MPPSC',2026,'SKTech Sample','approved'),
('Which of the following is a greenhouse gas?','Oxygen','Nitrogen','Carbon dioxide','Argon','C','Carbon dioxide is a greenhouse gas.','निम्न में से कौन-सी ग्रीनहाउस गैस है?','ऑक्सीजन','नाइट्रोजन','कार्बन डाइऑक्साइड','आर्गन','Environment & Ecology','Climate Change','Greenhouse Gases','Easy','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('What is the capital of Madhya Pradesh?','Bhopal','Indore','Jabalpur','Gwalior','A','Bhopal is the capital of Madhya Pradesh.','मध्य प्रदेश की राजधानी क्या है?','भोपाल','इंदौर','जबलपुर','ग्वालियर','MP GK','MP General Knowledge','State Capital','Easy','English + Hindi','MPPSC/MPESB',2026,'SKTech Sample','approved'),
('Which national park is famous for tigers in Madhya Pradesh?','Kanha','Keoladeo','Gir','Kaziranga','A','Kanha National Park is a major tiger habitat in Madhya Pradesh.','मध्य प्रदेश का कौन-सा राष्ट्रीय उद्यान बाघों के लिए प्रसिद्ध है?','कान्हा','केवलादेव','गिर','काजीरंगा','MP Geography','Protected Areas','National Parks','Easy','English + Hindi','MPPSC/MPESB',2026,'SKTech Sample','approved'),
('Choose the correctly spelled word:','Accomodation','Accommodation','Acommodation','Accommadation','B','The correct spelling is Accommodation.','सही वर्तनी चुनिए:','Accomodation','Accommodation','Acommodation','Accommadation','English','Vocabulary','Spelling','Easy','English + Hindi','SSC/Banking',2026,'SKTech Sample','approved'),
('If A is the brother of B and B is the sister of C, how is A related to C?','Brother','Sister','Father','Uncle','A','A is male and sibling of B; B is sibling of C, so A is C’s brother.','यदि A, B का भाई है और B, C की बहन है, तो A का C से क्या संबंध है?','भाई','बहन','पिता','चाचा','Reasoning','Blood Relations','Family Tree','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('A shopkeeper gives a 10% discount on an item marked at ₹800. What is the selling price?','₹700','₹720','₹740','₹760','B','10% of ₹800 is ₹80; selling price = ₹720.','एक दुकानदार ₹800 अंकित मूल्य पर 10% छूट देता है। विक्रय मूल्य क्या होगा?','₹700','₹720','₹740','₹760','Mathematics','Profit Loss Discount','Discount','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('Which body replaced the Planning Commission of India?','Finance Commission','NITI Aayog','GST Council','Election Commission','B','NITI Aayog replaced the Planning Commission in 2015.','भारत के योजना आयोग का स्थान किस संस्था ने लिया?','वित्त आयोग','नीति आयोग','GST परिषद','निर्वाचन आयोग','Indian Economy','Planning','Institutions','Easy','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('Which of the following is NOT a fundamental right?','Right to Equality','Right to Freedom','Right to Property','Right against Exploitation','C','The Right to Property is a constitutional/legal right under Article 300A, not a Fundamental Right.','निम्न में से कौन-सा मौलिक अधिकार नहीं है?','समानता का अधिकार','स्वतंत्रता का अधिकार','संपत्ति का अधिकार','शोषण के विरुद्ध अधिकार','Indian Polity','Fundamental Rights','Rights','Moderate','English + Hindi','MPPSC/SSC',2026,'SKTech Sample','approved'),
('What is the binary representation of decimal 10?','1010','1001','1100','1110','A','10 in decimal equals 1010 in binary.','दशमलव 10 का बाइनरी रूप क्या है?','1010','1001','1100','1110','Computer','Number System','Binary','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('Which memory is volatile?','ROM','RAM','Hard Disk','SSD','B','RAM is volatile memory and loses its contents when power is removed.','कौन-सी मेमोरी volatile होती है?','ROM','RAM','हार्ड डिस्क','SSD','Computer','Computer Fundamentals','Memory','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('A train crosses a pole in 18 seconds at 54 km/h. What is the train length?','180 m','240 m','270 m','300 m','C','54 km/h = 15 m/s; length = 15 × 18 = 270 m.','एक ट्रेन 54 किमी/घं की गति से 18 सेकंड में एक खंभे को पार करती है। ट्रेन की लंबाई क्या है?','180 मी','240 मी','270 मी','300 मी','Mathematics','Time Speed Distance','Train','Moderate','English + Hindi','RRB NTPC',2026,'SKTech Sample','approved'),
('The largest planet in the Solar System is:','Earth','Jupiter','Saturn','Neptune','B','Jupiter is the largest planet in the Solar System.','सौरमंडल का सबसे बड़ा ग्रह कौन-सा है?','पृथ्वी','बृहस्पति','शनि','वरुण','General Science','Astronomy','Solar System','Easy','English + Hindi','RRB/SSC',2026,'SKTech Sample','approved'),
('Which pending-review question is intentionally included for testing?','Sample Pending A','Sample Pending B','Sample Pending C','Sample Pending D','A','This is a test record for the Admin Review Queue.','रिव्यू कतार की जांच के लिए कौन-सा प्रश्न जानबूझकर लंबित रखा गया है?','Sample Pending A','Sample Pending B','Sample Pending C','Sample Pending D','Current Affairs','Admin Testing','Review Queue','Moderate','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Test question: select the first option.','Pending Option 1','Pending Option 2','Pending Option 3','Pending Option 4','A','Admin can edit this record before approval.','टेस्ट प्रश्न: पहला विकल्प चुनिए।','लंबित विकल्प 1','लंबित विकल्प 2','लंबित विकल्प 3','लंबित विकल्प 4','Reasoning','Admin Testing','Review Queue','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Which subject should this sample be mapped to?','Mathematics','Reasoning','English','Computer','B','This is a pending classification test.','इस नमूना प्रश्न को किस विषय से मैप करना चाहिए?','गणित','रीजनिंग','अंग्रेजी','कंप्यूटर','Reasoning','Admin Testing','Classification','Moderate','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Pending bilingual question for review: 2 + 2 = ?','3','4','5','6','B','Basic arithmetic test for bilingual review.','रिव्यू हेतु द्विभाषी प्रश्न: 2 + 2 = ?','3','4','5','6','Mathematics','Arithmetic','Addition','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Admin review test: choose the correct capital of India.','Mumbai','New Delhi','Kolkata','Chennai','B','New Delhi is the capital of India.','एडमिन रिव्यू टेस्ट: भारत की राजधानी चुनिए।','मुंबई','नई दिल्ली','कोलकाता','चेन्नई','Indian Geography','Places','National Capital','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Pending sample: Which is a renewable source of energy?','Coal','Solar','Diesel','Natural Gas','B','Solar energy is renewable.','लंबित नमूना: नवीकरणीय ऊर्जा स्रोत कौन-सा है?','कोयला','सौर ऊर्जा','डीजल','प्राकृतिक गैस','General Science','Energy','Renewable Energy','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Pending sample: 15% of 200 is:','20','25','30','35','C','15% × 200 = 30.','लंबित नमूना: 200 का 15% कितना है?','20','25','30','35','Mathematics','Percentage','Basic Percentage','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Pending sample: Which institution regulates monetary policy in India?','RBI','SEBI','IRDAI','PFRDA','A','RBI conducts monetary policy in India.','लंबित नमूना: भारत में मौद्रिक नीति कौन नियंत्रित करता है?','RBI','SEBI','IRDAI','PFRDA','Banking Awareness','Monetary Policy','Institutions','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Pending sample: MP stands for which Indian state?','Madhya Pradesh','Maharashtra Pradesh','Manipur','Meghalaya Pradesh','A','MP is the abbreviation for Madhya Pradesh.','लंबित नमूना: MP किस भारतीय राज्य का संक्षिप्त रूप है?','मध्य प्रदेश','महाराष्ट्र प्रदेश','मणिपुर','मेघालय प्रदेश','MP GK','Basics','State Abbreviation','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending'),
('Pending sample: Which is used to measure temperature?','Barometer','Thermometer','Ammeter','Voltmeter','B','A thermometer measures temperature.','लंबित नमूना: तापमान मापने के लिए किसका उपयोग होता है?','बैरोमीटर','थर्मामीटर','एमीटर','वोल्टमीटर','General Science','Measurement','Temperature','Easy','English + Hindi','SKTech Test',2026,'SKTech Sample','pending')
on conflict do nothing;
