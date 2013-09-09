.PHONY: docs html

all: docs html batt.js

batt.js:
	cp ../batt.js ../batt.min.js .

html:
	./mksite

docs:
	cp ../docs/index.php docs.html
	cp ../docs/docs.css css/docs.css
	cp ../docs/docs.js js/docs.js
	cp ../lib/mustache.js js/
	cp -r ../examples docs/examples
	perl -pi -e 's/docs\.css/\/css\/docs.css/g; s/docs\.js/\/js\/docs.js/g; s/examples\//docs\/examples\//g' docs.html
	./mksite docs.html
