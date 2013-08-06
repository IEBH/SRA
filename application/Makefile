.PHONY: database

database:
	mysql crebpsearch <../database/Clean.sql
	mysql crebpsearch <../database/Schema.sql

batt-update: batt-pull

batt-pull:
	cd ../lib/batt;
		git pull;
	git add ../lib/batt
	git commit -m 'AUTO: Updated Batt to latest version'

batt-push:
	cd ../lib/batt;
		git push origin master
