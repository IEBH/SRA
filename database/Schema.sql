-- Headers {{{
SET storage_engine=MYISAM;
-- }}}
-- CacheResults {{{
DROP TABLE IF EXISTS wwwcache;
CREATE TABLE wwwcache(
	id int primary key auto_increment,
	hash char(32),
	age int,
	content text
);
CREATE INDEX wwwcache_hash ON wwwcache(hash);
-- }}}
