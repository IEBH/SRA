/**
* Plugin to provide mutli-form functionality within Batt
* This plugin works by binding itself to the hashChange window handler and switching forms based on the form URL
*
* For example if you have a form defined somewhere like: `{type: 'form', url: 'list'}` and the hash of the form is `list` that form will be the one thats opened
* This library uses the simple-capture module to match more complex URL strings allowing for clean looking URLS
*
* Examples:
*
*	`{type: 'form', url: 'list'}` // Matches #!/list
*	`{type: 'form', url: 'edit/[reportid]'}` // Matches #!/edit/123 and sets batt.params = {reportid: '123'}
*
* This function will also trigger the onSwitch event attached to the form object
*
* @requires Batt
* @author Matt Carter <m@ttcarter.com>
*/
$(function() {

$.extend(batt, {
	hashPrefix: '#!/', // Handle all page hash changes beginning with this prefix

	params: {}, // Extracted parameters from the URL matching expression (this is also added to batt.parseGlobals.params)

	hashChange: function(e) {
		var hash = document.location.hash;
		if (hash.substr(0, batt.hashPrefix.length)) { // Its a Batt managed hashbang
			hash = hash.substr(batt.hashPrefix.length); // Snip prefix
		}
		console.log('Multi-form> Raw Hash=', hash);
		var targetForm;
		batt.eachChild(function() {
			if (this.type == 'form' && this.url) { // Is a form and has a processable .url
				var params = batt.simpleCapture(this.url, hash);
				if (params) { // Matches?
					targetForm = this;
					batt.params = params;
					batt.parseGlobals.params = batt.params;
					return false; // Exit the eachChild loop
				}
			}
		});
		if (targetForm) { // Found a matching form
			console.log('Multi-form> Form=', targetForm.id);
			batt.switchForm(targetForm.id);
		} else { // No matching form - use blank switchForm() to switch to the first one found
			console.log('Multi-form> Form= No matching URL. Using first found form instead');
			batt.switchForm();
		}
	},

	/**
	* Open a form by its ID
	* If no ID is specified the first form will be opened
	* All other forms will be hidden (via obj.hide() calls)
	* This works by finding the ID and opening all the forms above it (depth first search) to the main batt object
	* @param string form The form to show.
	*/
	switchForm: function(form) {
		var formObj;

		if (!form) { // No specific specified - go to first found
			for (var f in batt.forms) {
				batt.forms[f].eachChild(function() {
					if (this.type == 'form' && !formObj) { // Found a form!
						formObj = this;
					}
				}, {depthFirst: true});
			}
		} else {
			formObj = batt.find(form);
		}

		formObj
			.eachParent(function() {
				for (var c in this.children) {
					if (this.children[c].type == 'form')
						this.children[c].hide();
				}
			})
			.eachChild(function() {
				this.clearData()
			})
			.show()
			.render()
			.trigger('switch');
	},

	/**
	* Implementation of the simpleCapture module from https://github.com/hash-bang/Node-simpleCapture
	* FIXME: This really belongs as a seperate module rather than pasted inline - use Bower/NPM to do that instead.

	* Captures portions of a string similar to a simplified RegExp
	* Examples:
	*
	*	/[uno]/[does]/[tres] with '/foo/bar/baz' => ['foo', 'bar', 'baz']
	*
	* @param string template the template string to capture
	* @param string string The string to examine
	* @return object|null The captured string objects or nothing
	*/
	simpleCapture: function (template, string) {
		var reStr = template
			.replace(/([\?\|\*])/, '\\$1'); // Escape weird RegExp characters

		var captures = [];
		var match;
		var re = /\[(.*?)\]/g;
		while (match = re.exec(reStr))
			captures.push(match);

		for (var c = captures.length - 1; c > -1; c--) {
			// Splice the reExp so that we capture each item (non-greedy if its not the last item)
			reStr = reStr.substr(0, captures[c].index) + (c < captures.length-1 ? '(.*?)' : '(.*)') + reStr.substr(captures[c].index + captures[c][0].length);
			captures[c] = captures[c][1]; // Set captures to the simple index offset of the RegExp
		}

		var re = new RegExp(reStr); // Compile newly mangled RegExp
		var found = re.exec(string); // Run on the string target
		if (!found) // No matches all all
			return;

		var out = {};
		for (var i in captures)
			out[captures[i]] = found[parseInt(i)+1];
		return out;
	}
});

$(window)
	.on('hashchange', batt.hashChange)
	.trigger('hashchange');

});
