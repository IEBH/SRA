-- Headers {{{
SET storage_engine=MYISAM;
-- }}}
-- Abstracts {{{
DROP TABLE IF EXISTS abstracts;
CREATE TABLE abstracts(
	id char(8) primary key,
	email varchar(255),
	status enum('hidden', 'listed', 'deleted') DEFAULT 'hidden',
	json text
);
CREATE INDEX abstracts_email ON abstracts(email);
CREATE INDEX abstracts_status ON abstracts(status);
-- }}}
