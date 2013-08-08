function batt_object(parameters) {
	$.extend(this, {
		id: null,
		value: null,
		default: null,
		element: null,
		containerDraw: 'with-label',
		uses: null,

		// Dummy functions
		validate: function() { return true; },
		render: function() { return true; },

		loadData: function() {
			if (this.data && this.data[this.id]) { // Is there anything in the data stream?
				this.value = this.data[this.id];
				this.dataBinding = this.id + '.' + this.data['_table_'] + '#' + this.data['_id'];
			} else if (this.default) { // Is there a default value?
				this.value = this.default;
			} else { // Found nothing - set to null
				this.value = null;
			}
		},

		/**
		* Locate the parent of the current Batt object and return either the stack of all parents (grand-parents etc.) or a specific type
		* Because of hash-of-hashes structure Batt uses to stash its objects this function does a top-down search of all forms and all children until it hits the current id, it then bubbles up as a return value to find the stack of all parents
		* @param string type Optional type to limit ourselves to. If specified the return will either be the first widget matching the type OR null
		* @return object|null|array If type is specified the first object matching the type OR null, if unspecified an array of all parents
		*/
		findParent: function(type) {
			var findParentWorker = function(id, context, stack) {
				if (!context.children)
					return;

				if (context.children[id]) {
					stack.push(context.children[id]);
					stack.push(context);
					return stack;
				}

				for (var c in context.children) {
					var found = findParentWorker(id, context.children[c], stack);
					if (found) {
						stack.push(context);
						return stack;
					}
				};
			};

			for (var b in $.batt.forms) {
				var stack = findParentWorker(this.id, $.batt.forms[b], []);
				if (stack) {
					if (type) { // Looking for a specific type
						for (var p in stack)
							if (stack[p].type == type)
								return stack[p];
						return null;
					}
					break;
				}
			}
		}
	});

	return this;
}
