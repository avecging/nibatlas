begin;
select no_plan();

-- The schema and document contract accept a profile URL plus copy-only contact ID.
create function pg_temp.channel_document() returns jsonb language sql as $$
  select jsonb_set(
    public.shop_edit_document('00000000-0000-4000-8000-000000000301'),
    '{links}',
    coalesce((public.shop_edit_document('00000000-0000-4000-8000-000000000301')->'links'), '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object('id','d5000000-0000-4000-8000-000000000001','link_type','social_instagram','url','https://www.instagram.com/pen-shop/','label','@pen-shop','is_official',true,'sort_order',0),
        jsonb_build_object('id','d5000000-0000-4000-8000-000000000002','link_type','contact_wechat','url',null,'label','store-id','is_official',true,'sort_order',1)
      )
  );
$$;

select lives_ok($$select public.validate_shop_document('00000000-0000-4000-8000-000000000301', pg_temp.channel_document())$$,
  'typed social URL and copy-only contact value pass document validation');
select throws_ok($$select public.validate_shop_document('00000000-0000-4000-8000-000000000301',
  jsonb_set(pg_temp.channel_document(), '{links}', (pg_temp.channel_document()->'links') ||
    jsonb_build_array(jsonb_build_object('id','d5000000-0000-4000-8000-000000000003','link_type','contact_wechat','url',null,'label','other-id','is_official',true,'sort_order',2))))$$,
  '22023', 'Duplicate catalogue item', 'a shop has only one row per contact platform');
select throws_ok($$select public.validate_shop_document('00000000-0000-4000-8000-000000000301',
  jsonb_set(pg_temp.channel_document(), '{links}', (pg_temp.channel_document()->'links') ||
    jsonb_build_array(jsonb_build_object('id','d5000000-0000-4000-8000-000000000004','link_type','directions','url',null,'label','Directions','is_official',false,'sort_order',2))))$$,
  '22023', 'Invalid link', 'legacy links still require a URL');

select * from finish();
rollback;
