clean:
	-rm batt.js batt.min.js

commit: batt.js batt.min.js
	git add batt.min.js batt.js
	git commit -m 'AUTO: Compiled batt.js / batt.min.js'

batt.js: src/*.js
	browserify -o batt.js -e src/batt.js -d

batt.min.js: batt.js
	uglifyjs -o batt.min.js batt.js

watch:
	watchify -o batt.js -e src/batt.js -d -v

gh-pages:
	git checkout gh-pages
	-git rm -rf .
	git checkout master img
	git checkout master lib
	git checkout master docs
	git checkout master batt.min.js
	git checkout master batt.js
	git mv -f docs/* .
	rmdir docs/
	git add .
	git commit -m 'AUTO: Generated gh-pages branch'
