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
-- Users {{{
-- NOTE: passhash = <8 hex salt><md5>
-- 1ae4f82fe031f85fbff0abf9812358c755c36c2d = 'password'
DROP TABLE IF EXISTS users;
CREATE TABLE users (
	userid int primary key auto_increment, 
	username varchar(50),
	fname varchar(50),
	lname varchar(50), 
	passhash char(40),
	passhash2 char(40),
	email varchar(100),
	status enum ('active', 'deleted') default 'active', 
	role enum ('user', 'admin', 'root') default 'user',
	created int,
	edited int,
	lastlogin int
);
INSERT INTO users VALUES (null, 'mc', ' Matt', 'Carter', '1ae4f82fe031f85fbff0abf9812358c755c36c2d', null, 'matt@mfdc.biz', 'active', 'root', 1364342313, 1364342313, 1364342313);
-- }}}
-- Libraries {{{
DROP TABLE IF EXISTS libraries;
CREATE TABLE libraries (
	libraryid int primary key auto_increment, 
	userid int,
	title varchar(200),
	status enum ('active', 'dedupe', 'deduped', 'deleted') default 'active', 
	dedupe_refid INT,
	dedupe_refid2 INT,
	created int,
	edited int
);
CREATE INDEX libraries_userid ON libraries(userid);
INSERT INTO libraries VALUES (null, 1, 'Sample library', 'active', null, null, null, null);
-- }}}
-- References {{{
DROP TABLE IF EXISTS `references`;
CREATE TABLE `references` (
	referenceid int primary key auto_increment, 
	libraryid int,
	status enum ('active', 'deleted') default 'active', 
	created int,
	edited int,
	title varchar(200),
	authors text,
	data text,
	altdata text
);
CREATE INDEX references_libraryid ON `references`(libraryid);
-- }}}
