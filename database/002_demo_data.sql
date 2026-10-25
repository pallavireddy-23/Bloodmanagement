-- Fictional inventory only. Run once after 001_schema.sql.
begin;
insert into public.donors(name,contact,blood_group) values
 ('Aarav Demo','Fictional donor · D001','O+'),('Diya Demo','Fictional donor · D002','A+'),('Kabir Demo','Fictional donor · D003','B+'),('Meera Demo','Fictional donor · D004','AB+'),('Isha Demo','Fictional donor · D005','O-'),('Rohan Demo','Fictional donor · D006','A-'),('Anaya Demo','Fictional donor · D007','B-'),('Vihaan Demo','Fictional donor · D008','AB-');
do $$ declare d record; n integer; donation bigint; begin
 for d in select * from public.donors where contact like 'Fictional donor%' loop
 for n in 1..4 loop
 insert into public.donations(donor_id,collected_at) values(d.donor_id,now()-interval '10 days') returning donation_id into donation;
 insert into public.blood_units(unit_id,donation_id,blood_group,expires_at,release_status,screening_note)
 values('BF-'||lpad(d.donor_id::text,2,'0')||n,donation,d.blood_group,now()+make_interval(days=>case n when 1 then 2 when 2 then 6 when 3 then 18 else -1 end),case when n=3 then 'quarantine' else 'released' end,'Fictional screening record');
 end loop;
 end loop;
end $$;
commit;
