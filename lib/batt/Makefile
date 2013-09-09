environment:
	# Install uglifyjs
	sudo apt-get install -y node-uglify

clean:
	-rm batt.js batt.min.js

batt.js: src/batt.js src/batt*.js
	cat src/batt.js src/batt_*.js >batt.js
	perl -pi -e 's/debug: true/debug: false/' batt.js
	uglifyjs -o batt.min.js batt.js
	git add batt.min.js batt.js
	git commit -m 'AUTO: Compiled batt.js / batt.min.js'

batt.browserify.js: batt.js
	browserify -o batt.browserify.js -e batt.js -d

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
