begin;
select no_plan();
insert into auth.users(id) values ('a1700000-0000-4000-8000-000000000001'),('a1700000-0000-4000-8000-000000000002'),('a1700000-0000-4000-8000-000000000003');
select public.assign_profile_role('a1700000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('a1700000-0000-4000-8000-000000000002','editor');
create function pg_temp.login(n integer) returns text language sql as $$ select set_config('request.jwt.claims',jsonb_build_object('sub','a1700000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated')::text,true) $$;
create function pg_temp.about_doc(title text default 'Synthetic About') returns jsonb language sql as $$ select jsonb_build_object(
 'title',title,'introduction','Test introduction','body','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Body"}]}]}'::jsonb,
 'teamHeading','Our team','thanksHeading','With thanks','people','[]'::jsonb,
 'support','{"enabled":false,"heading":"Support Nib Atlas","description":"Private preparation","buttonLabel":"Support","url":"https://example.com/private-support"}'::jsonb) $$;
create function pg_temp.about_revision() returns uuid language sql as $$ select (public.admin_about_page('read')->>'revision')::uuid $$;
select ok(public.read_published_about() is null,'no replacement published initially');
select ok(not has_table_privilege('anon','public.about_page','SELECT'),'anon cannot read table');
select ok(not has_table_privilege('authenticated','public.about_page','SELECT'),'signed in cannot read table');
select ok(not has_table_privilege('service_role','public.about_page','UPDATE'),'no service table write bypass');
select ok(not has_function_privilege('anon','public.admin_about_page(text,uuid,jsonb)','EXECUTE'),'anon cannot execute writer');
select ok(not has_function_privilege('authenticated','public.validate_about(jsonb,boolean)','EXECUTE'),'internal validation not exposed');
select pg_temp.login(2);
set local role authenticated;
select throws_ok($$select public.admin_about_page('read')$$,'42501','Admin access denied','editor cannot read About draft');
select throws_ok($$select public.admin_about_page('save',null,pg_temp.about_doc())$$,'42501','Admin access denied','editor cannot save');
select throws_ok($$select public.admin_about_page('publish')$$,'42501','Admin access denied','editor cannot publish');
reset role;
select pg_temp.login(3);
set local role authenticated;
select throws_ok($$select public.admin_about_page('read')$$,'42501','Admin access denied','ordinary account cannot read');
reset role;
select pg_temp.login(1);
set local role authenticated;
select ok(public.admin_about_page('read') is null,'authorized initial read is empty');
select lives_ok($$select public.admin_about_page('save',null,pg_temp.about_doc())$$,'admin saves private draft');
select ok(public.read_published_about() is null,'draft does not become public');
select throws_ok($$select public.admin_about_page('save',null,pg_temp.about_doc('Stale'))$$,'40001','About changed','competing first save refuses overwrite');
select lives_ok($$select public.admin_about_page('publish',pg_temp.about_revision())$$,'admin publishes saved revision');
select is(public.read_published_about()->>'title','Synthetic About','published copy readable');
select is(public.read_published_about()->'support'->>'url','','hidden support destination excluded');
select is(public.read_published_about()->'support'->>'description','','hidden support description excluded');
select is(public.admin_about_page('read')->'draft'->'support'->>'description','Private preparation','admin retains hidden support');
select lives_ok($$select public.admin_about_page('save',pg_temp.about_revision(),pg_temp.about_doc('Private edit'))$$,'new draft saved');
select is(public.read_published_about()->>'title','Synthetic About','old published copy stays intact');
select throws_ok($$select public.admin_about_page('publish','00000000-0000-4000-8000-000000000000')$$,'40001','About changed','stale publication refused');
select lives_ok($$select public.admin_about_page('publish',pg_temp.about_revision())$$,'replacement publishes');
select is(public.read_published_about()->>'title','Private edit','replacement visible');
select lives_ok($$select public.admin_about_page('publish',pg_temp.about_revision())$$,'publish retry idempotent');
reset role;
select is((select count(*)::integer from public.admin_audit_log where entity_type='about_page'),4,'save and publish each audited, retry adds nothing');
select ok(not exists(select 1 from public.admin_audit_log where entity_type='about_page' and (before_summary::text||after_summary::text) like '%Private%'),'audit does not contain draft text');
-- Invalid direct RPC calls cannot poison a subsequent public/admin read.
create function pg_temp.reject_about(d jsonb) returns boolean language plpgsql as $$ begin
 perform public.admin_about_page('save',pg_temp.about_revision(),d); return false;
 exception when sqlstate '22023' or sqlstate '22P02' then return true;end $$;
set local role authenticated;
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{support,url}','"javascript:alert(1)"')),'reject script links');
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{support,url}','"https://example.com:bogus"')),'reject malformed port');
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{support,url}','"https://example.com:99999"')),'reject out of range port');
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{support,url}',to_jsonb(url))),'reject ambiguous numeric host '||url)
 from (values ('https://001.002.003.008'),('https://01.02.03.09'),('https://example.0x'),('https://a.0X')) examples(url);
select lives_ok($$select public.admin_about_page('save',pg_temp.about_revision(),jsonb_set(pg_temp.about_doc(),'{support,url}','"https://127.0.0.1:8080/support"'))$$,'canonical numeric host remains valid');
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{title}',to_jsonb('About'||chr(1)))),'reject control chars');
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{people}','[{"id":"11111111111111111111111111111111","group":"team","name":"Test","description":"Research","url":""}]')),'reject noncanonical UUID');
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{body}','{"type":"doc","content":[{"type":"image","attrs":{"src":"x"}}]}')),'reject embedded image');
select ok(pg_temp.reject_about(jsonb_set(pg_temp.about_doc(),'{body}',jsonb_build_object('type','doc','content',jsonb_build_array(
 jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',repeat('x',31000)))),
 jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',repeat('y',31000)))))))),'reject aggregate over 60000');
select lives_ok($$select public.admin_about_page('save',pg_temp.about_revision(),jsonb_set(pg_temp.about_doc(),'{title}',to_jsonb(repeat('😀',160))))$$,'Unicode title obeys character count');
select lives_ok($$select public.admin_about_page('publish',pg_temp.about_revision())$$,'Unicode title publishes');
select lives_ok($$select public.admin_about_page('save',pg_temp.about_revision(),jsonb_set(pg_temp.about_doc(),'{support,enabled}','true'))$$,'configured support saves');
select lives_ok($$select public.admin_about_page('publish',pg_temp.about_revision())$$,'configured support publishes');
select is(public.read_published_about()->'support'->>'url','https://example.com/private-support','enabled support link visible');
select lives_ok($$select public.admin_about_page('save',pg_temp.about_revision(),jsonb_set(pg_temp.about_doc(),'{title}','"\t\n"'))$$,'incomplete title can be drafted');
select throws_ok($$select public.admin_about_page('publish',pg_temp.about_revision())$$,'22023','About title required','whitespace-only title cannot publish');
reset role;
select public.assign_profile_role('a1700000-0000-4000-8000-000000000001','user');
set local role authenticated;
select throws_ok($$select public.admin_about_page('read')$$,'42501','Admin access denied','revocation takes effect with same JWT');
reset role;
select * from finish();
rollback;
