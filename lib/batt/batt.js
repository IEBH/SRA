;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */

/*global define: false*/

(function (root, factory) {
  if (typeof exports === "object" && exports) {
    module.exports = factory; // CommonJS
  } else if (typeof define === "function" && define.amd) {
    define(factory); // AMD
  } else {
    root.Mustache = factory; // <script>
  }
}(this, (function () {

  var exports = {};

  exports.name = "mustache.js";
  exports.version = "0.7.2";
  exports.tags = ["{{", "}}"];

  exports.Scanner = Scanner;
  exports.Context = Context;
  exports.Writer = Writer;

  var whiteRe = /\s*/;
  var spaceRe = /\s+/;
  var nonSpaceRe = /\S/;
  var eqRe = /\s*=/;
  var curlyRe = /\s*\}/;
  var tagRe = /#|\^|\/|>|\{|&|=|!/;

  // Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
  // See https://github.com/janl/mustache.js/issues/189
  function testRe(re, string) {
    return RegExp.prototype.test.call(re, string);
  }

  function isWhitespace(string) {
    return !testRe(nonSpaceRe, string);
  }

  var isArray = Array.isArray || function (obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };

  function escapeRe(string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
  }

  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  }

  // Export the escaping function so that the user may override it.
  // See https://github.com/janl/mustache.js/issues/244
  exports.escape = escapeHtml;

  function Scanner(string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
  }

  /**
   * Returns `true` if the tail is empty (end of string).
   */
  Scanner.prototype.eos = function () {
    return this.tail === "";
  };

  /**
   * Tries to match the given regular expression at the current position.
   * Returns the matched text if it can match, the empty string otherwise.
   */
  Scanner.prototype.scan = function (re) {
    var match = this.tail.match(re);

    if (match && match.index === 0) {
      this.tail = this.tail.substring(match[0].length);
      this.pos += match[0].length;
      return match[0];
    }

    return "";
  };

  /**
   * Skips all text until the given regular expression can be matched. Returns
   * the skipped string, which is the entire tail if no match can be made.
   */
  Scanner.prototype.scanUntil = function (re) {
    var match, pos = this.tail.search(re);

    switch (pos) {
    case -1:
      match = this.tail;
      this.pos += this.tail.length;
      this.tail = "";
      break;
    case 0:
      match = "";
      break;
    default:
      match = this.tail.substring(0, pos);
      this.tail = this.tail.substring(pos);
      this.pos += pos;
    }

    return match;
  };

  function Context(view, parent) {
    this.view = view;
    this.parent = parent;
    this.clearCache();
  }

  Context.make = function (view) {
    return (view instanceof Context) ? view : new Context(view);
  };

  Context.prototype.clearCache = function () {
    this._cache = {};
  };

  Context.prototype.push = function (view) {
    return new Context(view, this);
  };

  Context.prototype.lookup = function (name) {
    var value = this._cache[name];

    if (!value) {
      if (name === ".") {
        value = this.view;
      } else {
        var context = this;

        while (context) {
          if (name.indexOf(".") > 0) {
            var names = name.split("."), i = 0;

            value = context.view;

            while (value && i < names.length) {
              value = value[names[i++]];
            }
          } else {
            value = context.view[name];
          }

          if (value != null) {
            break;
          }

          context = context.parent;
        }
      }

      this._cache[name] = value;
    }

    if (typeof value === "function") {
      value = value.call(this.view);
    }

    return value;
  };

  function Writer() {
    this.clearCache();
  }

  Writer.prototype.clearCache = function () {
    this._cache = {};
    this._partialCache = {};
  };

  Writer.prototype.compile = function (template, tags) {
    var fn = this._cache[template];

    if (!fn) {
      var tokens = exports.parse(template, tags);
      fn = this._cache[template] = this.compileTokens(tokens, template);
    }

    return fn;
  };

  Writer.prototype.compilePartial = function (name, template, tags) {
    var fn = this.compile(template, tags);
    this._partialCache[name] = fn;
    return fn;
  };

  Writer.prototype.compileTokens = function (tokens, template) {
    var fn = compileTokens(tokens);
    var self = this;

    return function (view, partials) {
      if (partials) {
        if (typeof partials === "function") {
          self._loadPartial = partials;
        } else {
          for (var name in partials) {
            self.compilePartial(name, partials[name]);
          }
        }
      }

      return fn(self, Context.make(view), template);
    };
  };

  Writer.prototype.render = function (template, view, partials) {
    return this.compile(template)(view, partials);
  };

  Writer.prototype._section = function (name, context, text, callback) {
    var value = context.lookup(name);

    switch (typeof value) {
    case "object":
      if (isArray(value)) {
        var buffer = "";

        for (var i = 0, len = value.length; i < len; ++i) {
          buffer += callback(this, context.push(value[i]));
        }

        return buffer;
      }

      return value ? callback(this, context.push(value)) : "";
    case "function":
      var self = this;
      var scopedRender = function (template) {
        return self.render(template, context);
      };

      var result = value.call(context.view, text, scopedRender);
      return result != null ? result : "";
    default:
      if (value) {
        return callback(this, context);
      }
    }

    return "";
  };

  Writer.prototype._inverted = function (name, context, callback) {
    var value = context.lookup(name);

    // Use JavaScript's definition of falsy. Include empty arrays.
    // See https://github.com/janl/mustache.js/issues/186
    if (!value || (isArray(value) && value.length === 0)) {
      return callback(this, context);
    }

    return "";
  };

  Writer.prototype._partial = function (name, context) {
    if (!(name in this._partialCache) && this._loadPartial) {
      this.compilePartial(name, this._loadPartial(name));
    }

    var fn = this._partialCache[name];

    return fn ? fn(context) : "";
  };

  Writer.prototype._name = function (name, context) {
    var value = context.lookup(name);

    if (typeof value === "function") {
      value = value.call(context.view);
    }

    return (value == null) ? "" : String(value);
  };

  Writer.prototype._escaped = function (name, context) {
    return exports.escape(this._name(name, context));
  };

  /**
   * Low-level function that compiles the given `tokens` into a function
   * that accepts three arguments: a Writer, a Context, and the template.
   */
  function compileTokens(tokens) {
    var subRenders = {};

    function subRender(i, tokens, template) {
      if (!subRenders[i]) {
        var fn = compileTokens(tokens);
        subRenders[i] = function (writer, context) {
          return fn(writer, context, template);
        };
      }

      return subRenders[i];
    }

    return function (writer, context, template) {
      var buffer = "";
      var token, sectionText;

      for (var i = 0, len = tokens.length; i < len; ++i) {
        token = tokens[i];

        switch (token[0]) {
        case "#":
          sectionText = template.slice(token[3], token[5]);
          buffer += writer._section(token[1], context, sectionText, subRender(i, token[4], template));
          break;
        case "^":
          buffer += writer._inverted(token[1], context, subRender(i, token[4], template));
          break;
        case ">":
          buffer += writer._partial(token[1], context);
          break;
        case "&":
          buffer += writer._name(token[1], context);
          break;
        case "name":
          buffer += writer._escaped(token[1], context);
          break;
        case "text":
          buffer += token[1];
          break;
        }
      }

      return buffer;
    };
  }

  /**
   * Forms the given array of `tokens` into a nested tree structure where
   * tokens that represent a section have two additional items: 1) an array of
   * all tokens that appear in that section and 2) the index in the original
   * template that represents the end of that section.
   */
  function nestTokens(tokens) {
    var tree = [];
    var collector = tree;
    var sections = [];

    var token;
    for (var i = 0, len = tokens.length; i < len; ++i) {
      token = tokens[i];
      switch (token[0]) {
      case '#':
      case '^':
        sections.push(token);
        collector.push(token);
        collector = token[4] = [];
        break;
      case '/':
        var section = sections.pop();
        section[5] = token[2];
        collector = sections.length > 0 ? sections[sections.length - 1][4] : tree;
        break;
      default:
        collector.push(token);
      }
    }

    return tree;
  }

  /**
   * Combines the values of consecutive text tokens in the given `tokens` array
   * to a single token.
   */
  function squashTokens(tokens) {
    var squashedTokens = [];

    var token, lastToken;
    for (var i = 0, len = tokens.length; i < len; ++i) {
      token = tokens[i];
      if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
        lastToken[1] += token[1];
        lastToken[3] = token[3];
      } else {
        lastToken = token;
        squashedTokens.push(token);
      }
    }

    return squashedTokens;
  }

  function escapeTags(tags) {
    return [
      new RegExp(escapeRe(tags[0]) + "\\s*"),
      new RegExp("\\s*" + escapeRe(tags[1]))
    ];
  }

  /**
   * Breaks up the given `template` string into a tree of token objects. If
   * `tags` is given here it must be an array with two string values: the
   * opening and closing tags used in the template (e.g. ["<%", "%>"]). Of
   * course, the default is to use mustaches (i.e. Mustache.tags).
   */
  exports.parse = function (template, tags) {
    template = template || '';
    tags = tags || exports.tags;

    if (typeof tags === 'string') tags = tags.split(spaceRe);
    if (tags.length !== 2) {
      throw new Error('Invalid tags: ' + tags.join(', '));
    }

    var tagRes = escapeTags(tags);
    var scanner = new Scanner(template);

    var sections = [];     // Stack to hold section tokens
    var tokens = [];       // Buffer to hold the tokens
    var spaces = [];       // Indices of whitespace tokens on the current line
    var hasTag = false;    // Is there a {{tag}} on the current line?
    var nonSpace = false;  // Is there a non-space char on the current line?

    // Strips all whitespace tokens array for the current line
    // if there was a {{#tag}} on it and otherwise only space.
    function stripSpace() {
      if (hasTag && !nonSpace) {
        while (spaces.length) {
          tokens.splice(spaces.pop(), 1);
        }
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    }

    var start, type, value, chr;
    while (!scanner.eos()) {
      start = scanner.pos;
      value = scanner.scanUntil(tagRes[0]);

      if (value) {
        for (var i = 0, len = value.length; i < len; ++i) {
          chr = value.charAt(i);

          if (isWhitespace(chr)) {
            spaces.push(tokens.length);
          } else {
            nonSpace = true;
          }

          tokens.push(["text", chr, start, start + 1]);
          start += 1;

          if (chr === "\n") {
            stripSpace(); // Check for whitespace on the current line.
          }
        }
      }

      start = scanner.pos;

      // Match the opening tag.
      if (!scanner.scan(tagRes[0])) {
        break;
      }

      hasTag = true;
      type = scanner.scan(tagRe) || "name";

      // Skip any whitespace between tag and value.
      scanner.scan(whiteRe);

      // Extract the tag value.
      if (type === "=") {
        value = scanner.scanUntil(eqRe);
        scanner.scan(eqRe);
        scanner.scanUntil(tagRes[1]);
      } else if (type === "{") {
        var closeRe = new RegExp("\\s*" + escapeRe("}" + tags[1]));
        value = scanner.scanUntil(closeRe);
        scanner.scan(curlyRe);
        scanner.scanUntil(tagRes[1]);
        type = "&";
      } else {
        value = scanner.scanUntil(tagRes[1]);
      }

      // Match the closing tag.
      if (!scanner.scan(tagRes[1])) {
        throw new Error('Unclosed tag at ' + scanner.pos);
      }

      // Check section nesting.
      if (type === '/') {
        if (sections.length === 0) {
          throw new Error('Unopened section "' + value + '" at ' + start);
        }

        var section = sections.pop();

        if (section[1] !== value) {
          throw new Error('Unclosed section "' + section[1] + '" at ' + start);
        }
      }

      var token = [type, value, start, scanner.pos];
      tokens.push(token);

      if (type === '#' || type === '^') {
        sections.push(token);
      } else if (type === "name" || type === "{" || type === "&") {
        nonSpace = true;
      } else if (type === "=") {
        // Set the tags for the next time around.
        tags = value.split(spaceRe);

        if (tags.length !== 2) {
          throw new Error('Invalid tags at ' + start + ': ' + tags.join(', '));
        }

        tagRes = escapeTags(tags);
      }
    }

    // Make sure there are no open sections when we're done.
    var section = sections.pop();
    if (section) {
      throw new Error('Unclosed section "' + section[1] + '" at ' + scanner.pos);
    }

    return nestTokens(squashTokens(tokens));
  };

  // The high-level clearCache, compile, compilePartial, and render functions
  // use this default writer.
  var _writer = new Writer();

  /**
   * Clears all cached templates and partials in the default writer.
   */
  exports.clearCache = function () {
    return _writer.clearCache();
  };

  /**
   * Compiles the given `template` to a reusable function using the default
   * writer.
   */
  exports.compile = function (template, tags) {
    return _writer.compile(template, tags);
  };

  /**
   * Compiles the partial with the given `name` and `template` to a reusable
   * function using the default writer.
   */
  exports.compilePartial = function (name, template, tags) {
    return _writer.compilePartial(name, template, tags);
  };

  /**
   * Compiles the given array of tokens (the output of a parse) to a reusable
   * function using the default writer.
   */
  exports.compileTokens = function (tokens, template) {
    return _writer.compileTokens(tokens, template);
  };

  /**
   * Renders the `template` with the given `view` and `partials` using the
   * default writer.
   */
  exports.render = function (template, view, partials) {
    return _writer.render(template, view, partials);
  };

  // This is here for backwards compatibility with 0.4.x.
  exports.to_html = function (template, view, partials, send) {
    var result = exports.render(template, view, partials);

    if (typeof send === "function") {
      send(result);
    } else {
      return result;
    }
  };

  return exports;

}())));

},{}],2:[function(require,module,exports){
module.exports = function () {
	this.defaultEquals = true; // If we can't find a valid handler default to key==val behaviour (i.e. {'foo': 'bar'} tests that the key 'foo' is the value 'bar')
	this.silent = false; // Shut up if we cant find a suitable handler

	this.handlers = [];

	this.myFilter = null;
	this.myData = null;
	this.myLimit = null;
	this.myWantArray = false;

	this.init = function() {
		this.addHandler(/^(.*?) ={1,2}$/, function(key, val, data) { // {'foo =': 'bar'} or {'foo ==': 'bar'}
			return (data[key] == val);
		});
		this.addHandler(/^(.*?) >$/, function(key, val, data) { // {'foo >': 'bar'}
			return (data[key] > val);
		});
		this.addHandler(/^(.*?) <$/, function(key, val, data) { // {'foo <': 'bar'}
			return (data[key] < val);
		});
		this.addHandler(/^(.*?) (?:>=|=>)$/, function(key, val, data) { // {'foo >=': 'bar'} (or '=>')
			return (data[key] >= val);
		});
		this.addHandler(/^(.*?) (?:<=|=<)$/, function(key, val, data) { // {'foo <=': 'bar'} or ('=<')
			return (data[key] <= val);
		});
	};

	// Simple setters {{{
	this.filter = function(filter) {
		this.myFilter = filter;
		return this;
	};

	this.data = function(data) {
		this.myData = data;
		return this;
	};

	this.limit = function(limit) {
		this.myLimit = limit;
		return this;
	};

	this.wantArray = function(wantArray) {
		this.myWantArray = wantArray === undefined ? true : wantArray;
		return this;
	};
	// }}}

	this.reset = function() {
		this.myData = null;
		this.myFilter = null;
		this.myWantArray = false;
		this.myLimit = 0;
		return this;
	};

	this.addHandler = function(re, callback) {
		this.handlers.push([re, callback]);
	};

	this.exec = function(filter, data, limit) {
		var out = this.myWantArray ? [] : {};
		var found = 0;
		if (!filter)
			filter = this.myFilter;
		if (!data)
			data = this.myData;
		if (!limit)
			limit = this.myLimit;

		for (var id in data) {
			var row = data[id];
			if (this.matches(filter, row)) {
				if (this.myWantArray) {
					out.push(row);
				} else
					out[id] = row;

				if (limit && ++found >= limit)
					break;
			}
		}
		return out;
	};

	this.matches = function(filter, data) {
		for (var key in filter) {
			var handled = false;
			for (var h in this.handlers) {
				var matches;
				if (matches = this.handlers[h][0].exec(key)) { // Use this handler
					handled = true;
					if (this.handlers[h][1](matches[1], filter[key], data)) {
						// console.log('OK');
					} else {
						return false;
					}
				}
			}
			if (!handled)
				if (this.defaultEquals) {
					if (data[key] != filter[key])
						return false;
				} else {
					if (!this.silent)
						console.warn('No filter matching incomming string "' + key + '". Defaulting to no-match');
					return false;
				}
		}
		return true;
	};

	this.init();
}

},{}],3:[function(require,module,exports){
var global=self;/**
* Batt
* Form and data manipulation library
*
* @url https://github.com/MomsFriendlyDevCo/Batt
* @author Matt Carter <m@ttcarter.com>
* @license CC-Attribution-NonCommercial-NoDerivs 3.0 Unported
* @licenseURL http://creativecommons.org/licenses/by-nc-nd/3.0/
*/

// REQUIRE - Batt objects {{{
var batt_object = require('./batt_object.js');

var batt_date = require('./batt_date.js');
batt_date.prototype = new batt_object();
var batt_choice = require('./batt_choice.js');
batt_choice.prototype = new batt_object();
var batt_choice_radio = require('./batt_choice_radio.js');
batt_choice_radio.prototype = new batt_object();
var batt_container = require('./batt_container.js');
batt_container.prototype = new batt_object();
var batt_container_splitter = require('./batt_container_splitter.js');
batt_container_splitter.prototype = new batt_container();

var batt_feed = require('./batt_feed.js');
batt_feed.prototype = new batt_container();
var batt_feed_batt = require('./batt_feed_batt.js');
batt_feed_batt.prototype = new batt_feed();

var batt_dropdown = require('./batt_dropdown.js');
batt_dropdown.prototype = new batt_container();
var batt_form = require('./batt_form.js');
batt_form.prototype = new batt_container();
var batt_reference = require('./batt_reference.js');
batt_reference.prototype = new batt_container();
var batt_table = require('./batt_table.js');
batt_table.prototype = new batt_container();
var batt_tabs = require('./batt_tabs.js');
batt_tabs.prototype = new batt_container();

var batt_input = require('./batt_input.js');
batt_input.prototype = new batt_object();
var batt_label = require('./batt_label.js');
batt_label.prototype = new batt_object();
var batt_string = require('./batt_string.js');
batt_string.prototype = new batt_input();
var batt_number = require('./batt_number.js');
batt_number.prototype = new batt_input();
var batt_text = require('./batt_text.js');
batt_text.prototype = new batt_input();

var batt_file = require('./batt_file.js');
batt_file.prototype = new batt_object();
var batt_heading = require('./batt_heading.js');
batt_heading.prototype = new batt_object();
var batt_html = require('./batt_html.js');
batt_html.prototype = new batt_object();

var batt_link = require('./batt_link.js');
batt_link.prototype = new batt_object();
var batt_button = require('./batt_button.js');
batt_button.prototype = new batt_link();
var batt_tag = require('./batt_tag.js');
batt_tag.prototype = new batt_link();

var batt_unknown = require('./batt_unknown.js');
batt_unknown.prototype = new batt_object();
// }}}
// REQUIRE - Third party modules {{{
var Mustache = require('mustache');
// }}}

global.batt = {
	debug: true, // This is changed during script compile to FALSE
	forms: {},
	usesPath: '', // Assume current directory is where we find 'uses' modules
	isReady: false,
	sets: [],
	stop: false,

	feeds: {},

	widgets: {
		button: {inherits: 'link', object: require('./batt_button.js')},
		choice: {inherits: 'object', object: require('./batt_choice.js')},
		choice_radio: {inherits: 'object', object: require('./batt_choice_radio.js')},
		container: {inherits: 'object', object: require('./batt_container.js')},
		container_splitter: {inherits: 'container', object: require('./batt_container_splitter.js')},
		date: {inherits: 'object', object: require('./batt_date.js')},
		dropdown: {inherits: 'container', object: require('./batt_dropdown.js')},
		feed_batt: {inherits: 'feed', object: require('./batt_feed_batt.js')},
		feed: {inherits: 'container', object: require('./batt_feed.js')},
		file: {inherits: 'object', object: require('./batt_file.js')},
		form: {inherits: 'container', object: require('./batt_form.js')},
		heading: {inherits: 'object', object: require('./batt_heading.js')},
		html: {inherits: 'object', object: require('./batt_html.js')},
		input: {inherits: 'object', object: require('./batt_input.js')},
		label: {inherits: 'object', object: require('./batt_label.js')},
		link: {inherits: 'object', object: require('./batt_link.js')},
		number: {inherits: 'input', object: require('./batt_number.js')},
		object: {object: require('./batt_object.js')},
		reference: {inherits: 'container', object: require('./batt_reference.js')},
		string: {inherits: 'input', object: require('./batt_string.js')},
		table: {inherits: 'container', object: require('./batt_table.js')},
		tabs: {inherits: 'container', object: require('./batt_tabs.js')},
		tag: {inherits: 'link', object: require('./batt_tag.js')},
		text: {inherits: 'input', object: require('./batt_text.js')},
		unknown: {inherits: 'object', object: require('./batt_unknown.js')}
	},

	/**
	* Variables available to object.parse()
	* @var hash
	*/
	parseGlobals: {
		/**
		* Extracts a URL segment using a mangled version of a glob
		* 
		* Tokens:
		*	- '*' - Match any number of characters
		*	- '?' - Match one chracter
		*	- '!' - Capture this
		*
		* Examples:
		*	- {{#url}}/users/!{{/url}}
		*	- {{#url}}/path/to/dir/!{{/url}}
		*	- {{#url}}/users/type/* /userid!{{/url}} (space added after '*' so not to upset syntax parsers that see it as end-of-comments)
		*/
		url: function(text, render) { // Url extractor function - e.g. 
			return function(text, render) {
				var reStr = text
					.replace('*', '<FILTER:ANY>')
					.replace('?', '<FILTER:ONE>')
					.replace('!', '<FILTER:CAPTURE>')
					.replace(/([.?*+^$[\]\/\\(){}|-])/g, "\\$1")
					.replace('<FILTER:ANY>', '.*')
					.replace('<FILTER:ONE>', '.')
					.replace('<FILTER:CAPTURE>', '(.*)');
				var re = new RegExp(reStr);
				var found = re.exec(document.location.pathname);
				var bit = found[1] || '';
				return bit;
			}
		}
	},

	ready: function() {
		console.log('BATT READY');
		this.isReady = true;

		$.each(this.sets, function(i, set) {
			console.log('Trigger load of', set);
			if (set.element) { // Load into element i.e. invoke $(element).batt(content)
				set.element.batt(set.content);
			} else // No element - probably an anonymous load (i.e. batt.set(content))
				batt.set(set.content);
		});

		this.sets = [];
	},

	makeObject: function(type) {
		var obj;
		type = type.replace('-', '_');
		if (!batt.widgets[type]) {
			type = 'unknown';
			obj = new batt.widgets[type].object();
			obj.typeFailed = obj.type;
		} else {
			obj = new batt.widgets[type].object();
		}
		obj.type = type;
		if (batt.widgets[type].inherits) {
			var proto = new batt.widgets[batt.widgets[type].inherits].object();
			obj.prototype = proto;
			obj.super = proto;
		}
		return obj;
	},

	/**
	* Load a Batt plugin from plugins/$name.js
	* This is really just a dumb wrapper for $script()
	* @param string|array name Either a single plugin to load or an array of plugins to load
	*/
	plugin: function(name) {
		if (typeof name == 'array') { // Given an array - overload to individual calls
			for (var p in name)
				batt.plugin(name[p]);
		} else {
			console.log('Batt> Loading plugin ', name);
			$script(batt.path + '/plugins/' + name + '.js');
		}
	},

	/**
	* Load generic Batt spec into an anonymous object
	* This will never actually appear. Its mostly used to load db-table widgets etc
	* @param string json The Batt object spec to load
	*/
	set: function(json) {
		var id = batt.getUniqueId('batt-form-');
		if (batt.isReady) {
			batt.forms[id] = new batt_form();
			batt.forms[id].type = 'form';
			batt.forms[id].set(json);
		} else { // Not yet ready
			console.log('Batt not yet ready. Defered load for anonymous object', id);
			batt.sets.push({
				content: json
			});
		}
	},

	find: function(id) {
		if (batt.forms[id]) // Is the ID an actual form?
			return batt.forms[id];

		for (var f in batt.forms) { // Nope. Recurse into each form
			var found = batt.forms[f].find(id);
			if (found)
				return found;
		}
		return null;
	},

	/**
	* Simple wrapper to run a function on ALL batt objects
	* This is really just a dumb wrapper for running .eachChild on all items in the batt.forms hash
	* @param callback callback The callback function to run. Called in the format function() {} setting 'this' to the current context
	* @param hash options A hash of options to use when filtering
	* @see batt_container/eachChild()
	*/
	eachChild: function(callback, options) {
		for (var f in batt.forms) {
			if (batt.forms[f].eachChild(callback, options) === false)
				return;
		}
	},

	submit: function() {
		for (var f in batt.forms) {
			batt.forms[f].submit();
		}
	},

	/**
	* Scripts that loadScripts() is waiting on.
	* These are usually from tags specified using 'src="path"' in the tag
	* @access private
	*/
	loadScriptsSrc: {},

	/**
	* Scripts that are waiting to load from this document.
	* Similar to loadScriptsSrc except we have these from inline
	* @access private
	*/
	loadScriptsInline: [],

	/**
	* Information about the script currently being eval()'ed
	* This is used by the $(window).on('error') handler to display a nice message rather than just giving up
	* @var array
	* @access private
	*/
	evalInfo: null,

	/**
	* Process all <script type="batt" [src="path"]/> tags
	*/
	loadScripts: function() {
		var ready = 1;
		$('script[type="batt"]').each(function() {
			var script = $(this);
			var scriptSrc = script.attr('src');
			if (scriptSrc) { // Has an src="path" attribute
				if (batt.loadScriptsSrc[scriptSrc] == 'loading') { // Still waiting for this script to load
					ready = 0;
				} else if (batt.loadScriptsSrc[scriptSrc] == 'loaded') { // Loaded content - this script is ready
					// Do nothing
				} else if (!batt.loadScriptsSrc[scriptSrc]) { // First mention of this script we've seen - trigger AJAX load
					batt.loadScriptsSrc[scriptSrc] = 'loading';
					$.ajax({
						url: scriptSrc,
						dataType: 'text',
						type: 'GET',
						data: {noheaders: 1},
						cache: true,
						success: function(html) {
							batt.loadScriptsSrc[scriptSrc] = 'loaded';
							script.replaceWith(html);
							batt.loadScripts();
						},
						error: function(jqxhr, errText, errThrown) {
							console.warn('Error while loading <script src="' + scriptSrc + '"/>', errText, errThrown); // FIXME: deal with this gracefully
						}
					});
					ready = 0;
				}
			} else { // Load from content
				var newId = batt.getUniqueId('batt-');
				script.before('<div id="' + newId + '"></div>')
				batt.loadScriptsInline.push('$(\'#' + newId + '\').batt(' + script.html() + ');');
				script.remove();
			}
		});
		if (ready) {
			$(window).on('error', function(e) {
				console.log('CAUGHT', e.originalEvent, batt.evalInfo);
				batt.stop = 1;
				if (batt.evalInfo) { // We have something to complain about
					var box = $(batt.evalInfo.id);
					var message = e.originalEvent.message.replace(/^Uncaught SyntaxError: /, '');
					var line = e.originalEvent.lineno;
					box.append('<div class="alert alert-block alert-error"><h3>Batt failed to load - ' + message + (line ? ' (Line: ' + line + ')' : '') + '</h3></div>');
					if (line) { // We have a specific line number to look at
						var block = batt.loadScriptsInline[batt.evalInfo.loadScriptsInlineOffset].split("\n");
						box.find('div.alert')
							.append($('<pre></pre>').text(block.slice(0, line - 1).join("\n")))
							.append('<div class="label label-warning">' + message + ':</div>')
							.append($('<pre class="alert"></pre>').text(block.slice(line - 1, line)))
							.append($('<pre></pre>').text(block.slice(line).join("\n")));
						
					} else { // We have no idea where the error occured
						box.find('div.alert').append(
							$('<pre></pre>').text(batt.loadScriptsInline[batt.evalInfo.loadScriptsInlineOffset])
						);
					}
				}
			});
			for (var i = batt.loadScriptsInline.length - 1; i > -1; i--) {
				var matches = /\$\('(.*)'\)\.batt\(/.exec(batt.loadScriptsInline[i]);
				batt.evalInfo = {
					loadScriptsInlineOffset: i,
					id: matches[1]
				};
				eval(batt.loadScriptsInline[i]);
			}
			batt.evalInfo = null;
			batt.loadScriptsInline = [];
		} else {
			console.log('Inline <script> tags waiting on', Object.keys(batt.loadScriptsSrc));
		}
	},

	// Utility functions {{{
	/**
	* Parse a Mustache template
	* @param string string The string to parse and return
	* @param object Additional object data to include in the template
	* @return string The parsed string
	*/
	parse: function(string, data) {
		var data = $.extend({}, batt.parseGlobals, data);
		var out = Mustache.render(string, data);
		// console.log('BATT.PARSE', string, '=', out, data);
		return out;
	},

	/**
	* Sanitize a string and return the safe version devoid of anything dangerous
	* @param string value The string to sanitize
	* @param string prefix Optional prefix to prepend to the output
	* @return string The safe version of the input 'value'
	*/
	safeString: function(value, prefix) {
		return (prefix?prefix:'') + value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	},

	/**
	* Return a unique ID for an item based on a prefix
	* This is usually used to allocate an HTML ID to an element that doesnt already have one
	*/
	getUniqueId: function(prefix) {
		if (!prefix)
			prefix = 'batt-';
		while (1) {
			var id = prefix + Math.floor(Math.random()*99999);
			if ($('#' + id).length == 0)
				return id;
		}
	}
	// }}}
};

batt.ready();

$.fn.extend({
	batt: function(json) {
		return this.each(function() {
			var me = $(this);
			var id = me.attr('id');
			var content = json || me.text();
			if (!id) { // Make sure the item has an ID - make one if necessary
				id = batt.getUniqueId('batt-form-');
				me.attr('id', id)
			}
			if (batt.isReady) {
				batt.forms[id] = batt.makeObject('form');
				batt.forms[id].set(content);
				batt.forms[id].element = me;
				batt.forms[id].setup.call(batt.forms[id]);
				batt.forms[id].render.call(batt.forms[id]);
			} else { // Not yet ready
				console.log('Batt not yet ready. Defered load for form', id);
				batt.sets.push({
					element: me,
					content: content
				});
			}
		});
	}
});

// Trigger initial sweep for <script type="batt"/> tags
$(batt.loadScripts);

},{"./batt_button.js":4,"./batt_choice.js":5,"./batt_choice_radio.js":6,"./batt_container.js":7,"./batt_container_splitter.js":8,"./batt_date.js":9,"./batt_dropdown.js":10,"./batt_feed.js":11,"./batt_feed_batt.js":12,"./batt_file.js":13,"./batt_form.js":14,"./batt_heading.js":15,"./batt_html.js":16,"./batt_input.js":17,"./batt_label.js":18,"./batt_link.js":19,"./batt_number.js":20,"./batt_object.js":21,"./batt_reference.js":22,"./batt_string.js":23,"./batt_table.js":24,"./batt_tabs.js":25,"./batt_tag.js":26,"./batt_text.js":27,"./batt_unknown.js":28,"mustache":1}],4:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'buttons',
		action: 'nothing',
		classes: 'btn',
		render: function() {
			this.super.render.call(this);
			return this;
		}
	}, parameters);

	return this;
};

},{}],5:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		renderTag: '<select></select>',
		choices: {
			foo: 'Foo',
			bar: 'Bar',
			baz: 'Baz'
		},
		setup: function() {
			var me = this;
			me.element = $(me.renderTag);
			me.element.on('change', function() {
				me.value = $(this).val();
				me.change.call(me);
			});
			return this;
		},
		render: function() {
			var me = this;
			me.element.empty();
			for (var id in me.choices) {
				me.element.append('<option value="' + id + '">' + me.choices[id] + '</option>');
			}

			if (me.value) {
				me.element.val(me.value);
			} else { // No value - select the first
				me.element
					.val( me.element.find('option:first').attr('value') )
					.trigger('change');
			}
			return this;
		}
	}, parameters);

	return this;
};

},{}],6:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		renderTag: '<div></div>',
		choices: {},

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;

			this.element.empty();
			for (var id in this.choices) {
				var label = $('<label class="radio"></label>')
					.appendTo(this.element);
				var radio = $('<input type="radio" name="' + me.id + '" value="' + id + '">' + this.choices[id] + '</label>')
					.appendTo(label)
					.on('change', function() {
						me.value = $(this).val();
						me.change.call(me);
					});
			}

			if (this.value)
				this.element.find('input[value="' + this.value + '"]').prop('checked', true);
			return this;
		}
	}, parameters);

	return this;
};

},{}],7:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		children: {},
		childrenOrder: [],
		containerDraw: 'row',
		implyChild: 'unknown', // Default to this if no child type is specified
		dataSource: null, // What data source to use (usually a hash structure)
		renderTag: '<div></div>', // What wrapper to use when drawing the container
		classes: '',

		/**
		* Runs a function on each child of this container
		* This function is recursive. If you require just the immediate children use $.each(container.children, function() { })
		* @param callback callback The callback function to run. Called in the format function() {} setting 'this' to the current context
		* @param hash options A hash of options to use when filtering
		* @param object object Context object (internal use only)
		* @return object This chainable object
		*/
		eachChild: function(callback, options, context) {
			if (!context)
				context = this;
			if (!context.children)
				return;

			var settings = $.extend({}, {
				andSelf: false, // Include this item in the first callback
				depthFirst: false // Trigger callbacks from the deepest first
			}, options);

			if (settings.andSelf && !settings.depthFirst)
				callback.call(context);

			if (!context.childrenOrder)
				context.childrenOrder = Object.keys(context.children);

			for (var cid in context.childrenOrder) {
				var child = context.children[context.childrenOrder[cid]];
				if (!settings.depthFirst)
					callback.call(child);
				if (child.children)
					this.eachChild.call(child, callback, options, child);
				if (settings.depthFirst)
					callback.call(child);
			};

			if (settings.andSelf && !settings.depthFirst)
				callback.call(context);
			return this;
		},

		/**
		* Locate a object by its ID under this one
		* @param string id The ID of the object to find
		* @param object context Internal use only - provide the context to scan
		* @return null|object Either the found object or null
		*/
		find: function(id, context) {
			if (!context)
				context = this;

			if (!context.children)
				return;

			if (context.children[id])
				return context.children[id];

			for (var c in context.children) {
				var found = this.find(id, context.children[c]);
				if (found)
					return found;
			};
			return null;
		},

		/**
		* Extract all 'uses' directives from a complexly nested JSON object and return as an array
		* @param object json The nested JSON object to process
		* @return array An array of all uses directives
		*/
		determineUses: function(json) {
			var uses = {};

			var usesWorker = function(json, uses) { 
				$.each(json, function(i, j) {
					if (j.children)
						usesWorker(j.children, uses)
					if (j.uses)
						uses[j.uses] = 1;
				});
			}
			
			usesWorker(json, uses);
			return Object.keys(uses);
		},

		/**
		* Add a new batt object to a container
		* NOTE: This will not re-render the parent you will have to call this.render() to do that
		* @param mixed JSON data that defines the object
		* @param string where Optional where condition. Enum of: 'last' (default), 'after'
		* @param string id If where=='after' this is the existing child to insert after. If the child ID is not found the new item is appended
		* @return object This chainable object
		*/
		addChild: function(obj, where, id) {
			var me = this;
			var child = null;

			if (!obj.uses) // Inherit 'uses' from parent if not specified
				obj.uses = me.uses;

			if (obj.import) { // No type explicit but it looks like we are inheriting
				var matches = /^(.*)\.(.*)$/.exec(obj.import);
				if (matches) {
					var importFeed = matches[1];
					var importId = matches[2];
					if (!batt.feeds[importFeed]) {
						console.warn('Non-existant feed to import from. Feed=' + importFeed + ', ID=' + importId);
						return;
					} else if (!batt.feeds[importFeed].children[importId]) {
						console.warn('Non-existant feed ID to import from. Feed=' + importFeed + ', ID=' + importId + ' (feed exists but child does not)');
						return;
					} else { // All is well
						child = batt.feeds[importFeed].children[importId];
						child.dataBinding = importId;
					}
				} else { // FIXME: Would be nice if there were some other way of importing
					console.warn('Import reference "' + obj.import + '" is invalid. Format must be "feed.id"');
				}
			} else if (!obj.type && obj.uses && obj.id && batt.feeds[obj.uses].children[obj.id]) { // No type explicit but it looks like we are inheriting
				console.warn('Inheritance from .uses is depcreciated!');
				child = batt.feeds[obj.uses].children[obj.id];
			} else { // Type explicit OR no uses
				child = batt.makeObject(obj.type ? obj.type : me.implyChild);
			}

			if (!obj.id) { // Set up an ID - even if one doesnt already exist
				obj.id = batt.getUniqueId('field-');
				obj.idFake = true;
			} else if (!obj.idFake && !obj.title) // Set up nice looking title if done doesnt exist
				obj.title = obj.id.charAt(0).toUpperCase() + obj.id.substr(1);

			if (obj.uses && batt.feeds[obj.uses] && batt.feeds[obj.uses].children[obj.id]) { // Uses is something AND there is a table/col pair matching this definition - inheirt from base class + table + options
				child = batt.feeds[obj.uses].children[obj.id];
				child.dataBinding = obj.uses + '.' + obj.id;
				$.extend(child, obj);
			} else // No uses directive - just inherit from base class + options
				$.extend(child, obj);

			switch (where) {
				case 'after':
					var existing = me.childrenOrder.indexOf(id);
					if (!id) { 
						console.warn('batt_container.addChild(object, "after", "' + id + '")> Asked to insert after non-existant id "' + id + '". Inserting at end instead');
						me.childrenOrder.push(child.id);
					} else {
						me.childrenOrder.splice(existing + 1, 0, child.id);
					}
					break;
				case 'last':
				default:
					me.childrenOrder.push(child.id);
			}
			me.children[child.id] = child;
			child.setup();

			if (child.children) // Initalize all children
				child.set(child.children, true);
			return this;
		},

		/**
		* Remove a child object by its ID
		* @param string id The ID of the child to remove
		* @return object This chainable object
		*/
		removeChild: function(id) {
			var existing = this.childrenOrder.indexOf(id);
			if (!id) { 
				console.warn('batt_container.removeChild("' + id + '")> Asked to remove non-existant id "' + id + '"');
			} else {
				this.childrenOrder.splice(existing, 1);
				delete this.children[id];
			}
			return this;
		},

		/**
		* Take a complex JSON array and call add() on each item
		* This function also clears the existing children
		* @param string json The JSON object to process
		* @param bool isChild Internal property to prevent recursive 'uses' loads
		* @return object This chainable object
		*/
		set: function(json, isChild) {
			var me = this;
			me.children = {};
			me.childrenOrder = [];

			// Prevent race condition - processing tree before child.uses module loads are ready {{{
			if (!isChild) { // Master parent has already been invoked - we are propbably inside a recursive load
				var nonLoadedUses = [];
				var loads = this.determineUses(json);
				for (var l in loads) {
					console.log('REQUIRES', loads[l], batt.feeds[loads[l]]);
					if (!batt.feeds[loads[l]])
						nonLoadedUses.push(batt.usesPath + loads[l]);
				}
				if (nonLoadedUses.length) {
					console.log('Defer loading into ', json, ' wait for modules:', nonLoadedUses);
					$script(nonLoadedUses, function(notFound) {
						console.log('LOADED MODULES', nonLoadedUses, notFound);
						if (batt.stop)
							return;
						me
							.set(json)
							.render();
					}, function(notFound) {
						console.warn('CANNOT LOAD MODULES', notFound);
					});
					return;
				}
			}
			// }}}

			$.each(json, function(i, obj) {
				me.addChild(obj);
			});
			return this;
		},

		/**
		* Retrieve the next data row if .dataSource is specified
		* @return object The data object (also set in this.data for convenience)
		*/
		getData: function() {
			if (!this.dataSource) {
				console.warn('batt_container> Asked to getData() but no dataSource specified');
			} else {
				this.dataSource.dataRowOffset++;
				if (this.dataSource.data && this.dataSource.data.payload && this.dataSource.dataRowOffset < this.dataSource.data.payload.length) {
					this.data = this.dataSource.data.payload[this.dataSource.dataRowOffset];
					this.data['_table'] = this.dataSource.table;
					return this.data;
				} else {
					return 0;
				}
			}
		},

		rewindData: function() {
			this.dataSource.dataRowOffset = -1;
			this.data = null;
			return this.data;
		},

		clearData: function() {
			if (this.dataSource) {
				delete this.dataSource.data;
				this.rewindData();
			}
			return this;
		},

		/**
		* Tell the container dataSource to load its data
		* @param callback success Function to call when data load has completed
		*/
		loadContainerData: function(success) {
			var me = this;
			if (!this.dataSource) {
				console.warn('No dataSource specified when trying to load data!', this);
			} else if (!this.dataSource.feed) {
				console.warn('No dataSource.feed specified when trying to load data!');
			} else if (!batt.feeds[this.dataSource.feed]) {
				console.warn('Requested data from dataSource "' + this.dataSource.feed + '" that is not loaded!');
			} else if (!this.dataSource.data) { // Data not already loaded
				var ds = $.extend({}, me.dataSource, {
					fields: Object.keys(batt.feeds[me.dataSource.feed].children)
				});

				if (ds.filters) { // Parse all filter arguments
					var newFilters = {};
					for (var key in ds.filters) {
						newFilters[key] = me.parse(ds.filters[key]);
					}
					ds.filters = newFilters;
				}

				batt.feeds[ds.feed].getData(ds, function(json) {
					me.dataSource.data = json;
					me.dataSource.dataRowOffset = -1;
					me.render();
				}, function(errText, errThrown) {
					me.element.find('.batt-loading').remove();
					me.element.append('<div class="alert">Error loading data: ' + errText + ' - ' + errThrown + '</div>');
				});
			} else { // Render children with data
				success();
			}
		},

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		/**
		* Draw this container object
		* @return object This chainable object
		*/
		render: function() {
			var me = this;
			if (!me.element) {
				console.log('batt_form> Told to render but with no element', me);
				return;
			}

			if (!me.childrenOrder || !me.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				if (!me.children) {
					console.warn('batt_container> Told to render but I have no children!', me);
					return;
				}
				me.childrenOrder = Object.keys(me.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', me);
			}

			if (me.dataSource) {
				me.loadContainerData(function() {
					me.element.empty();
					me.rewindData();
					var data;
					while (data = me.getData()) {
						// Copy me data into all children
						me.eachChild(function() {
							this.data = data;
							if (this.dataBinding)
								this.value = data[this.dataBinding];
						});

						for (var i in me.childrenOrder) {
							var child = me.children[me.childrenOrder[i]];
							child.loadData();
							child.render();

							me.renderRow(me.element, child);
						}
					}
				});
			} else { // No data to care about
				me.element.empty();
				for (var c in me.childrenOrder) {
					var child = me.children[me.childrenOrder[c]];
					child.loadData();
					child.render();

					me.renderRow(me.element, child);
				}
			}
			if (me.classes)
				this.element.addClass(me.classes);
			return this;
		},

		renderRow: function(element, child) {
			var me = this;
			if (!element) {
				console.warn('renderRow of none-existant element for child', child);
				return;
			}

			switch (child.containerDraw) { // Which method to use when drawing the field?
				case 'debug':
					element.append('<div>DEBUG CHILD</div>');
					break;
				case 'table-cell':
					child.wrapper = $('<td></td>');
					child.wrapper.append(child.element);
					element.append(child.wrapper);
					break;
				case 'row':
				case 'entire-row': // Dont try to do anything
					element.append(child.element);
					break;
				case 'span': // Expand over the row but with spacing
					child.wrapper = $('<div></div>');
					child.wrapper.first().append(child.element); // Load the child into the .controls div
					element.append(child.wrapper);
					break;
				case 'buttons': // Draw as button group
					child.wrapper = $(
						'<div class="form-actions" style="padding-left: 0px; text-align: center">'
						+ '<div class="text-center"></div>'
						+ '</div>'
					);
					child.wrapper.children('div').append(child.element); // Load the child into the .controls div
					element.append(child.wrapper);
					break;
				case 'hide-label': // Draw in usual place but without a label
					child.wrapper = $(
						'<div class="control-group">'
						+ '<div class="controls"></div>'
						+ '</div>'
					);
					child.wrapper.find('.controls').append(child.element); // Load the child into the .controls div
					element.append(child.wrapper);
					break;
				case 'normal':
				case 'with-label': // Wrap child in the usual fluff - label + input area
				default:
					child.wrapper = $(
						'<div class="control-group">'
						+ '<label class="control-label">' + (child.title || child.id) + '</label>'
						+ '<div class="controls"></div>'
						+ '</div>'
					);
					child.wrapper.find('.controls').append(child.element); // Load the child into the .controls div
					element.append(child.wrapper);
			}
			return this;
		},

		validate: function() {
			return this.validateChildren.call(this);
		},

		validateChildren: function() {
			var errors = {};
			for (var c in this.childrenOrder) {
				var id = this.childrenOrder[c];
				var child = this.children[id];
				var result = child.validate();
				if (typeof result == 'string') {
					errors[id] = result;
				} else if (typeof result == 'array') {
					$.extend(errors, result);
				} else if (typeof result == 'boolean') {
					errors[id] = 'Something went wrong';
				}
			}
			return errors;
		}
	}, parameters);

	return this;
};

},{}],8:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		target: null,
		renderTag: '<div></div>',
		splitOn: ',',
		splitInto: 'value',
		splitBetween: '',

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;
			if (!me.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				me.childrenOrder = Object.keys(me.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', me);
			}

			if (!me.target) {
				console.warn('batt_container_splitter> No target specified to work with');
				return;
			}
			if (!me.splitOn) {
				console.warn('batt_container_splitter> No splitOn specified to work with');
				return;
			}

			var tVal = me.parse(me.target);

			var splits = tVal.split(me.splitOn);
			for (var s in splits) {
				me.eachChild(function() {
					me.data[me.splitInto] = splits[s];
				});
				for (var c in me.childrenOrder) {
					var child = me.children[me.childrenOrder[c]];
					child.render();
					me.renderRow(me.element, child);
				}
				if (me.splitBetween && s < splits.length-1)
					me.element.append(me.splitBetween);
			}
			return this;
		}
	}, parameters);

	return this;
};

},{}],9:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		renderTag: '<div class="form-inline"></div>',
		showDate: true,
		showTime: true,
		readOnly: false,

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			if (this.showDate)
				this.element.append('<div class="input-prepend"><span class="add-on"><i class="icon-calendar"></i></span><input type="date" class="input-medium"/></div>');

			if (this.showDate && this.showTime)
				this.element.append('&nbsp;');

			if (this.showTime)
				this.element.append('<div class="input-prepend"><span class="add-on"><i class="icon-time"></i></span><input type="time" class="input-small"/>');

			if (this.readOnly)
				this.element.find('input')
					.attr('readonly', 'readonly')
					.addClass('disabledInput');
			return this;
		}
	}, parameters);

	return this;
};

},{}],10:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'normal',
		implyChild: 'link',
		text: '<i class="icon-align-justify"></i>',
		columnTitle: '&nbsp;',
		columnWidth: '50px',
		renderTag: '<div class="dropdown"></div>',

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;
			if (!me.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				me.childrenOrder = Object.keys(me.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', me);
			}

			var ddButton = $('<a class="btn" data-toggle="dropdown">' + (me.text || me.title) + '</a>')
				.appendTo(me.element);

			var ddItems = $('<ul class="dropdown-menu"></ul>')
				.appendTo(me.element);

			for (var c in me.childrenOrder) {
				var child = me.children[me.childrenOrder[c]];
				if (child.title == '-' || child.text == '-') { // Child is actually a seperator
					ddItems.append($('<li class="divider"></li>'));
				} else { // Child is a real boy!
					var childWrapper = $('<li></li>');
					child.render();
					childWrapper.append(child.element);
					ddItems.append(childWrapper);
				}
			}
			return this;
		}
	}, parameters);

	return this;
};

},{}],11:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		url: null,
		key: null,
		order: null,

		set: function(json) {
			var me = this;
			console.log('Loaded feed "' + me.id + '"');
			batt.feeds[me.id] = $.extend({}, me, {children: {}}); // Clone to global object (and nuke all children since we will be processing them next anyway)
			$.each(json, function(i, obj) {
				batt.feeds[me.id].addChild(obj);
			});
			batt.find(me.id).parent().removeChild(me.id); // Remove self from object lists
		},

		setup: function() { // Do nothing - this element will be removed during set() anyway
			return this;
		},

		render: function() { // As with setup() we dont draw this widget anyway
			return this;
		},

		getData: function(dataSource, success, fail) {
			console.warn('batt_db_feed> Asked to get data but no specific driver is setup');
			return this;
		},

		setData: function(filter, data, success, fail) {
			console.warn('batt_db_feed> Asked to set data but no specific driver is setup');
			return this;
		}
	}, parameters);

	return this;
};

},{}],12:[function(require,module,exports){
var simpleJsonFilter = require('simple-json-filter');

module.exports = function(parameters) {
	$.extend(this, {
		url: '/batt/api/feed',
		key: 'id',
		order: 'id',
		table: null, // Override if the remote table doesnt match this objects id
		fussy: false, // Apply filters to incomming JSON stream (i.e. dont trust the server to return the right data)

		/**
		* Initialize all child fields
		* This function also relocates this field into batt.feeds outside of the usual tree structure
		*/
		set: function(json) {
			if (this.table)
				this.table = this.id;
			this.super.set.call(this, json);
			return this;
		},

		/**
		* Retrieve some data based on a given filter + this.filter
		* @param array filter Hash of filters to use (basicly the SQL WHERE condition)
		* @param array fields The fields to retrieve
		* @param function success The success callback function. Called with function(json)
		* @param function fail The failed callback function. Called with function(errText, errThrown)
		* @return object This chainable object
		*/
		getData: function(dataSource, success, fail) {
			var me = this;
			$.ajax({
				url: me.url,
				dataType: 'json',
				type: 'POST',
				cache: false,
				data: {
					action: 'get',
					key: me.key,
					order: me.order,
					table: me.table || me.id,
					joins: dataSource.joins,
					filters: dataSource.filters,
					fields: dataSource.fields
				},
				success: function(json) {
					if (me.fussy) {
						var sjf = new simpleJsonFilter;
						json.payload = sjf
							.filter(dataSource.filters)
							.data(json.payload)
							.limit(dataSource.limit)
							.wantArray()
							.exec();
					}
					success(json);
				},
				error: function(jqxhr, errText, errThrown) {
					console.warn('Error while pulling data', errText, errThrown); // FIXME: deal with this gracefully
					fail(errText, errThrown);
				}
			});
			return this;
		},

		/**
		* Save data back to the Batt data feed
		* @param array filter Hash of filters to use (basicly the SQL WHERE condition)
		* @param array fields The fields to set for the given fitler
		* @param function success The success callback function. Called with function(json)
		* @param function fail The failed callback function. Called with function(errText, errThrown)
		* @return object This chainable object
		*/
		setData: function(dataSource, data, success, fail) {
			var me = this;
			$.ajax({
				url: me.url,
				dataType: 'json',
				type: 'POST',
				cache: false,
				data: {
					action: 'set',
					key: me.key,
					table: me.table || me.id,
					filters: dataSource.filters,
					fields: data
				},
				success: function(json) {
					success(json);
				},
				error: function(jqxhr, errText, errThrown) {
					console.warn('Error while setting data', errText, errThrown); // FIXME: deal with this gracefully
					fail(errText, errThrown);
				}
			});
			return this;
		}
	}, parameters);

	return this;
};

},{"simple-json-filter":2}],13:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		text: '<i class="icon-file"></i> Select file...',
		classes: 'btn',
		textUploading: '<i class="icon-file icon-white"></i> {{value}}',
		classesUploading: 'btn btn-success',
		renderTag: '<div><div style="display: none"><input type="file"/></div><a></a></div>',
		autoDuplicate: false,

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;
			var button = this.element.find('a')
				.on('click', function() {
					file.trigger('click');
				});
			var file = this.element.find('input[type=file]')
				.attr('name', me.id)
				.on('change', function() {
					me.render();
					if (me.autoDuplicate) {
						me.parent()
							.addChild($.extend({}, me, {id: batt.getUniqueId(me.id), value: null}), 'after', me.id)
							.render();
					}
				});
			if (file.val()) { // Has a file to upload
				me.value = file.val().replace(/\\/g,'/').replace( /.*\//,'');
				button
					.html(me.parse(me.textUploading))
					.removeClass(me.classes)
					.addClass(me.classesUploading);
			} else { // Nothing to upload but still has syling
				button
					.html(me.parse(me.text))
					.removeClass(me.classesUploading)
					.addClass(me.classes);
			}
			return this;
		}
	}, parameters);

	return this;
};

},{}],14:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		method: 'POST', // POST - Regular HTML submit, BATT - internal AJAX calls to a Batt server
		action: '?', // If type=html this is the location where the form will be submitted.
		renderTag: '<form action="{{this.action}}" method="POST" class="form-horizontal" enctype="multipart/form-data"></form>',

		submit: function() {
			var me = this;
			if (me.validate()) {
				console.log('SUBMIT> OK');

				// Get all children which request from a dataSource {{{
				var dataSources = [];
				me.eachChild(function() {
					if (this.dataSource)
						dataSources.push(this);
				});
				// }}}
				// FIXME: Avoid peers being inside peers
				// For each dataSource... {{{
				for (var i in dataSources) {
					var data = {};
					var ds = $.extend({}, dataSources[i].dataSource);
					// Evaluate all filters {{{
					if (ds.filters) { // Parse all filter arguments
						var newFilters = {};
						for (var key in ds.filters) {
							newFilters[key] = me.parse(ds.filters[key]);
						}
						ds.filters = newFilters;
					}
					// }}}
					dataSources[i].eachChild(function() {
						if (
							(this.dataBinding) // Has a data binding
							&& (batt.feeds[dataSources[i].dataSource.feed]) // The feed this item is pointing at is valid
							&& (batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding]) // The feed recognizes this child
							&& (batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding].allowSet) // The feed says this child item can be set
						) {
							if (batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding].dataId) { // Use alternate internal name for the dataId
								data[batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding].dataId] = this.value;
							} else { // No alternate specified - just pass the ID
								data[this.dataBinding] = this.value;
							}
						}
					});
					batt.feeds[dataSources[i].dataSource.feed].setData(ds, data, function() {
						console.log('FIXME: SAVED!');
					}, function() {
						console.log('FIXME: SAVE FAILED!');
					});
				}
				// }}}


				/*
				switch (me.method.toUpperCase()) {
					case 'POST':
						me.eachChild(function() {
							if (!this.idFake)
								me.element.append('<input type="hidden" name="' + this.id + '" value="' + (this.value !== null ? this.value : '') + '"/>');
						});
						me.element.trigger('submit');
						break;
					case 'BATT':
						var data = {};
						me.eachChild(function() {
							if (this.dataBinding)
								data[this.dataBinding] = this.value;
						});
						console.warn('Batt submission not yet supported');
						console.log('SAVE>', data);
						break;
					default:
						alert('Unsupported form type: ' + me.method);
				}
				*/
			} else {
				console.log('SUBMIT> FAIL');
			}
			return false;
		},

		setup: function() {
			var me = this;
			var form = $(me.parse(me.renderTag));
			if (me.element) { // Has parent element - probably allocated by main batt.js process during creation
				var outerForm = $(me.parse(me.renderTag))
					.appendTo(me.element);
				me.element = outerForm;
			} else { // No existing element - probably a nested object
				me.element = form;
			}
			return this;
		},

		render: function() {
			var me = this;
			if (!me.element) {
				console.log('batt_form> Told to render but with no parent element', me);
				return;
			}

			me.super.render.call(me);
			me.eachChild(function() { // Calculate initial state of all showIf events
				this.changeOther(false);
			});
			return this;
		}
	}, parameters);

	return this;
};

},{}],15:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'span',
		title: 'A heading',
		renderTag: '<legend></legend>',

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			this.element.html(this.title);
			return this;
		}
	}, parameters);

	return this;
};

},{}],16:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'span',
		text: '<div class="alert alert-info">Hello World</div>',
		classes: null,
		render: function() {
			var html = this.text || this.title;
			if (html.substr(0, 1) != '<') // Doesn't already have a tag structure
				html = '<div>' + html + '</div>';

			this.element = $(this.parse(html));

			if (this.classes)
				this.element.addClass(this.classes);
			return this;
		}
	}, parameters);

	return this;
};

},{}],17:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		placeholder: null,
		required: false,
		lengthMax: null,
		lengthMin: null,
		readOnly: null,
		errorRequired: 'String required',
		errorLengthMax: 'String too long',
		errorLengthMin: 'String too short',

		change: function() {
			this.value = this.element.val();
		},

		render: function() {
			var me = this;
			this
				.element = $('<input/>')
				.on('change', function() {
					me.change.call(me);
				});
			if (this.value)
				this.element.attr('value', this.value);
			if (this.placeholder)
				this.element.attr('placeholder', this.placeholder);
			if (this.readOnly)
				this.element
					.attr('readonly', 'readonly')
					.addClass('disabledInput');
			if (this.dataBinding)
				this.element.attr('batt-data-binding', this.dataBinding);
			return this;
		},

		validate: function() {
			if (this.required && !this.value)
				return this.errorRequired;
			if (this.lengthMax && this.value.length > this.lengthMax)
				return this.errorLengthMax;
			if (this.lengthMin && this.value.length > this.lengthMin)
				return this.errorLengthMin;
		}
	}, parameters);

	return this;
};

},{}],18:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		text: null,
		containerDraw: 'normal',
		classes: null,

		setup: function() {
			this.element = $('<label class="checkbox"></label>'); // Odd that Bootstrap has no other way of having non-weird looking form text
			return this;
		},

		render: function() {
			var me = this;
			me.element.html(me.parse(me.text || me.title || 'A label'));
			
			if (me.classes)
				me.element.addClass(me.classes);
			return this;
		}
	}, parameters);

	return this;
};

},{}],19:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		text: null,
		containerDraw: 'normal',
		action: 'nothing',
		classes: null,

		setup: function() {
			this.element = $('<a></a>');
			return this;
		},

		render: function() {
			var me = this;
			var action = me.parse(me.action);
			me.element
				.html(me.parse(me.text || me.title || 'A link'))
				.attr('href', action);
			
			if (me.classes)
				me.element.addClass(me.classes);

			switch (action) {
				case 'nothing':
					me.element.click(function(event) {
						event.preventDefault();
						alert('No action is assigned to this button');
					});
					break;
				case 'save':
				case 'submit':
					me.element.click(function(event) {
						event.preventDefault();
						me.findParent('form').submit();
					});
					break;
				default: // Assign as href link
					me.element.attr('href', action);
			}
			return this;
		}
	}, parameters);

	return this;
};

},{}],20:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		min: null,
		max: null,
		decimals: 0,
		errorMin: 'Number too small',
		errorMax: 'Number too large',

		render: function() {
			this.super.render.call(this);
			this.element.attr('type', 'number');
			if (this.decimals)
				this.element.attr('step', 'any');
			if (this.min)
				this.element.attr('min', this.min);
			if (this.max)
				this.element.attr('max', this.max);
			return this;
		},

		validate: function() {
			this.super.validate.call(this);
			if (this.min && this.value < this.min)
				return this.errorMin;
			if (this.max && this.value > this.max)
				return this.errorMax;
		}
	}, parameters);

	return this;
};

},{}],21:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		id: null,
		dataId: null, // If the internal storage refers to the field by another name - specify it here
		value: null,
		default: null,
		element: null,
		containerDraw: 'with-label',
		uses: null,
		showIf: null,

		// Dummy functions
		validate: function() { return; },
		render: function() { return this; },
		setup: function() { return this; },
		clearData: function() { return this; },

		loadData: function() {
			if (this.value) // We already have a value
				return this;

			if (this.data && this.data[this.id]) { // Is there anything in the data stream?
				this.value = this.data[this.id];
			} else if (this.default) { // Is there a default value?
				this.value = this.default;
			} else { // Found nothing - set to null
				this.value = null;
			}
			return this;
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

			for (var b in batt.forms) {
				var stack = findParentWorker(this.id, batt.forms[b], []);
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
			return stack.slice(1);
		},

		/**
		* Convenience wrapper for calling parents() and using only the first item of the array
		* @return object The parent (a container) of the current object
		*/
		parent: function() {
			var parents = this.findParent.call(this);
			return parents[0];
		},

		/**
		* Run a callback over each parent of the current object
		* This function is recursive. If you require just the immediate parents use object.parent()
		* This is the mirror function of eachChild()
		* @param callback callback The callback function to run. Called in the format function() {} setting 'this' to the current context
		* @param hash options A hash of options to use when filtering
		* @param object object Context object (internal use only)
		* @return object This chainable object
		*/
		eachParent: function(callback, options, context) {
			if (!context)
				context = this;

			var settings = $.extend({}, {
				andSelf: false
			}, options);

			if (settings.andSelf)
				callback.call(context);

			var nodes = this.findParent();
			for (var pid in nodes) {
				var node = nodes[pid];
				callback.call(node);
			};
			return this;
		},

		/**
		* Parse a Mustache template against the current object
		* This is really just a helper for the core batt.parse() function
		* @param string string The string to parse and return
		* @param object data Additional data to pass to the parse function
		* @return string The parsed string
		*/
		parse: function(string, data) {
			return batt.parse(string, data ? $.extend({}, this, data) : this);
		},

		change: function() {
			var me = this;
			// Trigger the changeOther event on all other items
			me
				.findParent('form')
				.eachChild(function() {
					if (this.id != me.id)
						this.changeOther.call(this, true);
				});
			return this;
		},

		changeOther: function(userChanged) {
			var me = this;
			if (me.showIf) {
				var show;
				/**
				* We found a showIf hash object.
				* These usually look like:
				*
				*	{foo: 'bar', baz: 'quz'} // Only show if foo=bar AND baz=quz
				*	{'foo is': 'empty'} // Only show object 'foo' has no children (also applicable: 'empty', 'nodata', 'no data')
				*	{'foo is': 'empty'} // Only show object 'foo' has SOME children (also applicable: 'children', 'data', 'not empty', 'notempty')
				*
				* NOTE: 'is' and 'has' are interchangable in the above syntax. So {'foo has': 'no children'} is the same as {'foo is': 'empty'}
				*
				*/
				if (typeof me.showIf == 'object') {
					var form = me.findParent('form');
					show = 1;
					for (var field in me.showIf) { // Cycle though all fields until we find something that DOESNT match
						var matches;
						if (matches = /^(.*) (?:is|has)$/.exec(field)) { // Uses 'is' syntax
							var obj
							switch (me.showIf[field]) {
								case 'children':
								case 'data':
								case 'notempty':
								case 'not empty':
									obj = form.find(matches[1]);
									if (!obj.children || !Object.keys(obj.children).length) {
										show = 0;
										break;
									}
									break;
								case 'no data':
								case 'nodata':
								case 'empty':
									obj = form.find(matches[1]);
									if (obj.children && Object.keys(obj.children).length > 0) {
										show = 0;
										break;
									}
									break;
								default:
									console.warn('Unknown query syntax:', field, '=',  me.showIf[field]);
							}
						} else if (me.showIf[field] != form.find(field).value) { // Standard key=val
							show = 0;
							break;
						}
					}
				} else if (typeof me.showIf == 'function') {
					show = me.showIf.call(me);
				}

				me.show(show, userChanged);
			}
			return this;
		},

		show: function(visible, animate) {
			if (visible || visible === undefined) {
				if (animate) {
					(this.wrapper || this.element).slideDown();
				} else 
					(this.wrapper || this.element).show();
			} else {
				if (animate) {
					(this.wrapper || this.element).slideUp();
				} else
					(this.wrapper || this.element).hide();
			}
			return this;
		},

		// This is really just a dumb alias for show(0)
		hide: function() {
			return this.show(false);
		},

		/**
		* Run a callback function if it exists
		* @param string name the name of the function (e.g. if 'foo' the function callback will be called 'onFoo')
		* @return object This chainable object
		*/
		trigger: function(name) {
			var funcName = 'on' + name.substr(0, 1).toUpperCase() + name.substr(1);
			if (typeof this[funcName] == 'function') {
				this[funcName].call(this);
			}
			return this;
		}
	});

	return this;
};

},{}],22:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'normal',

		renderTag: '<select></select>',
		renderItem: '<option value="{{data._id}}">{{data.title}}</option>',

		setup: function() {
			var me = this;
			me.element = $(me.renderTag);
			me.element.on('change', function() {
				me.value = $(this).val();
				me.change.call(me);
			});
			return this;
		},

		render: function() {
			var me = this;
			me.loadContainerData(function() {
				var data;
				me.element.empty()
				me.rewindData();

				while (data = me.getData()) {
					me.element.append($(me.parse(me.renderItem)));
				}

				if (me.value) {
					me.element.val(me.value);
				} else { // No value - select the first
					me.element
						.val( me.element.find('option:first').attr('value') )
						.trigger('change');
				}
			});
			return this;
		}
	}, parameters);

	return this;
};

},{}],23:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		render: function() {
			this.super.render.call(this);
			this.element.attr('type', 'text');
			return this;
		},
	}, parameters);

	return this;
};

},{}],24:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		columns: {}, // Where the raw objects used to generate the children reside
		columnOrder: [],

		renderTag: '<table class="table table-bordered table-striped"></table>',

		autoHide: true,

		refresh: function(callback) {
			var me = this;
			if (!me.columnOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				me.columnOrder = Object.keys(me.columns);
				// console.warn('No columnOrder specified. Inheriting from columns hash in hash order instead', me);
			}

			if (!me.element)
				me.element = $('<div class="well"><h3>Loading table...</h3></div>');

			if (!me.dataSource) {
				console.log('batt_table> No dataSource specified - What did you want me to render exactly?', me);
			} else {
				me.loadContainerData(function() {
					// Kill all children and regenerate
					me.children = {};
					me.childrenOrder = [];

					var data;
					while (data = me.getData()) {
						var rowId = batt.getUniqueId('batt-table-row-');
						me.children[rowId] = batt.makeObject('container');
						me.children[rowId].renderTag = '<tr></tr>';
						me.childrenOrder.push(rowId);

						me.children[rowId].set(me.columns); // Copy column prototype into new child

						for (var c in me.children[rowId].children) {
							me.children[rowId].children[c].containerDraw = 'table-cell';
						}

						me.children[rowId].eachChild(function() { // Copy data hash into children
							this.data = data;
						});
					}
					callback();
					me.change();
				});
			}
			return this;
		},

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;
			var redraw = function() {
				me.element.empty();
				me.show();
				if (me.childrenOrder.length) { // Has children
					var tableHead = $('<tr></tr>')
						.appendTo(me.element);
					for (var c in me.columnOrder) {
						var child = me.columns[me.columnOrder[c]];
						var tableCell = $('<th>' + (child.columnTitle || child.title || '&nbsp;') + '</th>')
							.appendTo(tableHead);
						if (child.columnWidth)
							tableCell.attr('width', child.columnWidth);
					}

					me.rewindData();
					for (var c in me.childrenOrder) {
						var child = me.children[me.childrenOrder[c]];
						child.loadData();
						child.setup();
						child.render();
						child.element.appendTo(me.element);
					}
				} else if (me.autoHide) { // No data - hide the element automatically?
					me.hide();
				}
			};
			if (me.children.length) { // Already has children - no need to redraw
				redraw();
			} else {
				me.refresh(redraw);
			}
			return this;
		}
	}, parameters);

	return this;
};

},{}],25:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		default: 0, // The default tab offset to select
		renderTag: '<div></div>',

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;
			if (!me.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				me.childrenOrder = Object.keys(me.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', me);
			}

			me.element.empty();

			// Draw tab selection pane {{{
			var tabHead = $('<ul class="nav nav-tabs"></ul>')
				.appendTo(me.element);
			for (var c in me.childrenOrder) {
				var child = me.children[me.childrenOrder[c]];
				child.linkHash = batt.safeString(child.title);
				tabHead.append('<li><a href="#' + child.linkHash + '" data-toggle="tab">' + child.title + '</a></li>');
			}
			// }}}
			// Draw actual tabs {{{
			var tabBody = $('<div class="tab-content"></div>')
				.appendTo(me.element);
			for (var c in me.childrenOrder) {
				var child = me.children[me.childrenOrder[c]];
				child.render();
				var tabContent = $('<div class="tab-pane" id="' + child.linkHash + '"></div>')
					.appendTo(tabBody);
				me.renderRow(tabContent, child);
			}
			// }}}
			// Select default tab {{{
			tabHead.find('a[data-toggle="tab"]').eq(me.default).tab('show');
			tabBody.find('div.tab-pane').eq(me.default).addClass('active');
			// }}}
			return this;
		}
	}, parameters);

	return this;
};

},{}],26:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'normal',
		action: 'nothing',
		classes: 'badge',
		render: function() {
			this.super.render.call(this);
		}
	}, parameters);

	return this;
};

},{}],27:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		renderTag: '<textarea></textarea>',

		setup: function() {
			this.element = $(this.renderTag)
			return this;
		},

		render: function() {
			this.element
				.html(this.value)
				.on('change', this.change);
			return this;
		},

		change: function() {
			this.value = this.element.val();
			this.super.change.call(this);
		}
	}, parameters);

	return this;
};

},{}],28:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'span',

		render: function() {
			this.element = $('<div class="alert alert-danger"><i class="icon-warning-sign"></i> ID: \'' + this.id + '\' Attempted to load none-existant Batt form type \'' + this.typeFailed + '\'</div>');
			if (this.children) {
				for (var c in this.children) {
					var child = this.children[c];
					this.element.append('<br/><strong>CHILD:</strong> ' + child.type);
				}
			}
			return this;
		},

		set: function() {
			// No-op
			return this;
		}
	}, parameters);

	return this;
};

},{}]},{},[3])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvbm9kZV9tb2R1bGVzL211c3RhY2hlL211c3RhY2hlLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L25vZGVfbW9kdWxlcy9zaW1wbGUtanNvbi1maWx0ZXIvaW5kZXguanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfYnV0dG9uLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2Nob2ljZS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9jaG9pY2VfcmFkaW8uanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfY29udGFpbmVyLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2NvbnRhaW5lcl9zcGxpdHRlci5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9kYXRlLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2Ryb3Bkb3duLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2ZlZWQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfZmVlZF9iYXR0LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2ZpbGUuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfZm9ybS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9oZWFkaW5nLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2h0bWwuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfaW5wdXQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfbGFiZWwuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfbGluay5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9udW1iZXIuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfb2JqZWN0LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X3JlZmVyZW5jZS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9zdHJpbmcuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGFibGUuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGFicy5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF90YWcuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGV4dC5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF91bmtub3duLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2phQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbk9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiLyohXG4gKiBtdXN0YWNoZS5qcyAtIExvZ2ljLWxlc3Mge3ttdXN0YWNoZX19IHRlbXBsYXRlcyB3aXRoIEphdmFTY3JpcHRcbiAqIGh0dHA6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanNcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmU6IGZhbHNlKi9cblxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIiAmJiBleHBvcnRzKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5OyAvLyBDb21tb25KU1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZhY3RvcnkpOyAvLyBBTURcbiAgfSBlbHNlIHtcbiAgICByb290Lk11c3RhY2hlID0gZmFjdG9yeTsgLy8gPHNjcmlwdD5cbiAgfVxufSh0aGlzLCAoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBleHBvcnRzID0ge307XG5cbiAgZXhwb3J0cy5uYW1lID0gXCJtdXN0YWNoZS5qc1wiO1xuICBleHBvcnRzLnZlcnNpb24gPSBcIjAuNy4yXCI7XG4gIGV4cG9ydHMudGFncyA9IFtcInt7XCIsIFwifX1cIl07XG5cbiAgZXhwb3J0cy5TY2FubmVyID0gU2Nhbm5lcjtcbiAgZXhwb3J0cy5Db250ZXh0ID0gQ29udGV4dDtcbiAgZXhwb3J0cy5Xcml0ZXIgPSBXcml0ZXI7XG5cbiAgdmFyIHdoaXRlUmUgPSAvXFxzKi87XG4gIHZhciBzcGFjZVJlID0gL1xccysvO1xuICB2YXIgbm9uU3BhY2VSZSA9IC9cXFMvO1xuICB2YXIgZXFSZSA9IC9cXHMqPS87XG4gIHZhciBjdXJseVJlID0gL1xccypcXH0vO1xuICB2YXIgdGFnUmUgPSAvI3xcXF58XFwvfD58XFx7fCZ8PXwhLztcblxuICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2lzc3Vlcy5hcGFjaGUub3JnL2ppcmEvYnJvd3NlL0NPVUNIREItNTc3XG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg5XG4gIGZ1bmN0aW9uIHRlc3RSZShyZSwgc3RyaW5nKSB7XG4gICAgcmV0dXJuIFJlZ0V4cC5wcm90b3R5cGUudGVzdC5jYWxsKHJlLCBzdHJpbmcpO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNXaGl0ZXNwYWNlKHN0cmluZykge1xuICAgIHJldHVybiAhdGVzdFJlKG5vblNwYWNlUmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZVJlKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvW1xcLVxcW1xcXXt9KCkqKz8uLFxcXFxcXF4kfCNcXHNdL2csIFwiXFxcXCQmXCIpO1xuICB9XG5cbiAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICBcIiZcIjogXCImYW1wO1wiLFxuICAgIFwiPFwiOiBcIiZsdDtcIixcbiAgICBcIj5cIjogXCImZ3Q7XCIsXG4gICAgJ1wiJzogJyZxdW90OycsXG4gICAgXCInXCI6ICcmIzM5OycsXG4gICAgXCIvXCI6ICcmI3gyRjsnXG4gIH07XG5cbiAgZnVuY3Rpb24gZXNjYXBlSHRtbChzdHJpbmcpIHtcbiAgICByZXR1cm4gU3RyaW5nKHN0cmluZykucmVwbGFjZSgvWyY8PlwiJ1xcL10vZywgZnVuY3Rpb24gKHMpIHtcbiAgICAgIHJldHVybiBlbnRpdHlNYXBbc107XG4gICAgfSk7XG4gIH1cblxuICAvLyBFeHBvcnQgdGhlIGVzY2FwaW5nIGZ1bmN0aW9uIHNvIHRoYXQgdGhlIHVzZXIgbWF5IG92ZXJyaWRlIGl0LlxuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzI0NFxuICBleHBvcnRzLmVzY2FwZSA9IGVzY2FwZUh0bWw7XG5cbiAgZnVuY3Rpb24gU2Nhbm5lcihzdHJpbmcpIHtcbiAgICB0aGlzLnN0cmluZyA9IHN0cmluZztcbiAgICB0aGlzLnRhaWwgPSBzdHJpbmc7XG4gICAgdGhpcy5wb3MgPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSB0YWlsIGlzIGVtcHR5IChlbmQgb2Ygc3RyaW5nKS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLmVvcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWlsID09PSBcIlwiO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmllcyB0byBtYXRjaCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBSZXR1cm5zIHRoZSBtYXRjaGVkIHRleHQgaWYgaXQgY2FuIG1hdGNoLCB0aGUgZW1wdHkgc3RyaW5nIG90aGVyd2lzZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW4gPSBmdW5jdGlvbiAocmUpIHtcbiAgICB2YXIgbWF0Y2ggPSB0aGlzLnRhaWwubWF0Y2gocmUpO1xuXG4gICAgaWYgKG1hdGNoICYmIG1hdGNoLmluZGV4ID09PSAwKSB7XG4gICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICB0aGlzLnBvcyArPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgICByZXR1cm4gbWF0Y2hbMF07XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNraXBzIGFsbCB0ZXh0IHVudGlsIHRoZSBnaXZlbiByZWd1bGFyIGV4cHJlc3Npb24gY2FuIGJlIG1hdGNoZWQuIFJldHVybnNcbiAgICogdGhlIHNraXBwZWQgc3RyaW5nLCB3aGljaCBpcyB0aGUgZW50aXJlIHRhaWwgaWYgbm8gbWF0Y2ggY2FuIGJlIG1hZGUuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuVW50aWwgPSBmdW5jdGlvbiAocmUpIHtcbiAgICB2YXIgbWF0Y2gsIHBvcyA9IHRoaXMudGFpbC5zZWFyY2gocmUpO1xuXG4gICAgc3dpdGNoIChwb3MpIHtcbiAgICBjYXNlIC0xOlxuICAgICAgbWF0Y2ggPSB0aGlzLnRhaWw7XG4gICAgICB0aGlzLnBvcyArPSB0aGlzLnRhaWwubGVuZ3RoO1xuICAgICAgdGhpcy50YWlsID0gXCJcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMDpcbiAgICAgIG1hdGNoID0gXCJcIjtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBtYXRjaCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoMCwgcG9zKTtcbiAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcocG9zKTtcbiAgICAgIHRoaXMucG9zICs9IHBvcztcbiAgICB9XG5cbiAgICByZXR1cm4gbWF0Y2g7XG4gIH07XG5cbiAgZnVuY3Rpb24gQ29udGV4dCh2aWV3LCBwYXJlbnQpIHtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xuICB9XG5cbiAgQ29udGV4dC5tYWtlID0gZnVuY3Rpb24gKHZpZXcpIHtcbiAgICByZXR1cm4gKHZpZXcgaW5zdGFuY2VvZiBDb250ZXh0KSA/IHZpZXcgOiBuZXcgQ29udGV4dCh2aWV3KTtcbiAgfTtcblxuICBDb250ZXh0LnByb3RvdHlwZS5jbGVhckNhY2hlID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX2NhY2hlID0ge307XG4gIH07XG5cbiAgQ29udGV4dC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uICh2aWV3KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZXh0KHZpZXcsIHRoaXMpO1xuICB9O1xuXG4gIENvbnRleHQucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdmFyIHZhbHVlID0gdGhpcy5fY2FjaGVbbmFtZV07XG5cbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICBpZiAobmFtZSA9PT0gXCIuXCIpIHtcbiAgICAgICAgdmFsdWUgPSB0aGlzLnZpZXc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXM7XG5cbiAgICAgICAgd2hpbGUgKGNvbnRleHQpIHtcbiAgICAgICAgICBpZiAobmFtZS5pbmRleE9mKFwiLlwiKSA+IDApIHtcbiAgICAgICAgICAgIHZhciBuYW1lcyA9IG5hbWUuc3BsaXQoXCIuXCIpLCBpID0gMDtcblxuICAgICAgICAgICAgdmFsdWUgPSBjb250ZXh0LnZpZXc7XG5cbiAgICAgICAgICAgIHdoaWxlICh2YWx1ZSAmJiBpIDwgbmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gdmFsdWVbbmFtZXNbaSsrXV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlID0gY29udGV4dC52aWV3W25hbWVdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5fY2FjaGVbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUuY2FsbCh0aGlzLnZpZXcpO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICBmdW5jdGlvbiBXcml0ZXIoKSB7XG4gICAgdGhpcy5jbGVhckNhY2hlKCk7XG4gIH1cblxuICBXcml0ZXIucHJvdG90eXBlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fY2FjaGUgPSB7fTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLmNvbXBpbGUgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB2YXIgZm4gPSB0aGlzLl9jYWNoZVt0ZW1wbGF0ZV07XG5cbiAgICBpZiAoIWZuKSB7XG4gICAgICB2YXIgdG9rZW5zID0gZXhwb3J0cy5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gICAgICBmbiA9IHRoaXMuX2NhY2hlW3RlbXBsYXRlXSA9IHRoaXMuY29tcGlsZVRva2Vucyh0b2tlbnMsIHRlbXBsYXRlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZm47XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5jb21waWxlUGFydGlhbCA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZSwgdGFncykge1xuICAgIHZhciBmbiA9IHRoaXMuY29tcGlsZSh0ZW1wbGF0ZSwgdGFncyk7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlW25hbWVdID0gZm47XG4gICAgcmV0dXJuIGZuO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuY29tcGlsZVRva2VucyA9IGZ1bmN0aW9uICh0b2tlbnMsIHRlbXBsYXRlKSB7XG4gICAgdmFyIGZuID0gY29tcGlsZVRva2Vucyh0b2tlbnMpO1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHJldHVybiBmdW5jdGlvbiAodmlldywgcGFydGlhbHMpIHtcbiAgICAgIGlmIChwYXJ0aWFscykge1xuICAgICAgICBpZiAodHlwZW9mIHBhcnRpYWxzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICBzZWxmLl9sb2FkUGFydGlhbCA9IHBhcnRpYWxzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gcGFydGlhbHMpIHtcbiAgICAgICAgICAgIHNlbGYuY29tcGlsZVBhcnRpYWwobmFtZSwgcGFydGlhbHNbbmFtZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZm4oc2VsZiwgQ29udGV4dC5tYWtlKHZpZXcpLCB0ZW1wbGF0ZSk7XG4gICAgfTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpIHtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlKHRlbXBsYXRlKSh2aWV3LCBwYXJ0aWFscyk7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5fc2VjdGlvbiA9IGZ1bmN0aW9uIChuYW1lLCBjb250ZXh0LCB0ZXh0LCBjYWxsYmFjaykge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKG5hbWUpO1xuXG4gICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgdmFyIGJ1ZmZlciA9IFwiXCI7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgYnVmZmVyICs9IGNhbGxiYWNrKHRoaXMsIGNvbnRleHQucHVzaCh2YWx1ZVtpXSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHZhbHVlID8gY2FsbGJhY2sodGhpcywgY29udGV4dC5wdXNoKHZhbHVlKSkgOiBcIlwiO1xuICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHNjb3BlZFJlbmRlciA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSkge1xuICAgICAgICByZXR1cm4gc2VsZi5yZW5kZXIodGVtcGxhdGUsIGNvbnRleHQpO1xuICAgICAgfTtcblxuICAgICAgdmFyIHJlc3VsdCA9IHZhbHVlLmNhbGwoY29udGV4dC52aWV3LCB0ZXh0LCBzY29wZWRSZW5kZXIpO1xuICAgICAgcmV0dXJuIHJlc3VsdCAhPSBudWxsID8gcmVzdWx0IDogXCJcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayh0aGlzLCBjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl9pbnZlcnRlZCA9IGZ1bmN0aW9uIChuYW1lLCBjb250ZXh0LCBjYWxsYmFjaykge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKG5hbWUpO1xuXG4gICAgLy8gVXNlIEphdmFTY3JpcHQncyBkZWZpbml0aW9uIG9mIGZhbHN5LiBJbmNsdWRlIGVtcHR5IGFycmF5cy5cbiAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4NlxuICAgIGlmICghdmFsdWUgfHwgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl9wYXJ0aWFsID0gZnVuY3Rpb24gKG5hbWUsIGNvbnRleHQpIHtcbiAgICBpZiAoIShuYW1lIGluIHRoaXMuX3BhcnRpYWxDYWNoZSkgJiYgdGhpcy5fbG9hZFBhcnRpYWwpIHtcbiAgICAgIHRoaXMuY29tcGlsZVBhcnRpYWwobmFtZSwgdGhpcy5fbG9hZFBhcnRpYWwobmFtZSkpO1xuICAgIH1cblxuICAgIHZhciBmbiA9IHRoaXMuX3BhcnRpYWxDYWNoZVtuYW1lXTtcblxuICAgIHJldHVybiBmbiA/IGZuKGNvbnRleHQpIDogXCJcIjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl9uYW1lID0gZnVuY3Rpb24gKG5hbWUsIGNvbnRleHQpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cChuYW1lKTtcblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKGNvbnRleHQudmlldyk7XG4gICAgfVxuXG4gICAgcmV0dXJuICh2YWx1ZSA9PSBudWxsKSA/IFwiXCIgOiBTdHJpbmcodmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuX2VzY2FwZWQgPSBmdW5jdGlvbiAobmFtZSwgY29udGV4dCkge1xuICAgIHJldHVybiBleHBvcnRzLmVzY2FwZSh0aGlzLl9uYW1lKG5hbWUsIGNvbnRleHQpKTtcbiAgfTtcblxuICAvKipcbiAgICogTG93LWxldmVsIGZ1bmN0aW9uIHRoYXQgY29tcGlsZXMgdGhlIGdpdmVuIGB0b2tlbnNgIGludG8gYSBmdW5jdGlvblxuICAgKiB0aGF0IGFjY2VwdHMgdGhyZWUgYXJndW1lbnRzOiBhIFdyaXRlciwgYSBDb250ZXh0LCBhbmQgdGhlIHRlbXBsYXRlLlxuICAgKi9cbiAgZnVuY3Rpb24gY29tcGlsZVRva2Vucyh0b2tlbnMpIHtcbiAgICB2YXIgc3ViUmVuZGVycyA9IHt9O1xuXG4gICAgZnVuY3Rpb24gc3ViUmVuZGVyKGksIHRva2VucywgdGVtcGxhdGUpIHtcbiAgICAgIGlmICghc3ViUmVuZGVyc1tpXSkge1xuICAgICAgICB2YXIgZm4gPSBjb21waWxlVG9rZW5zKHRva2Vucyk7XG4gICAgICAgIHN1YlJlbmRlcnNbaV0gPSBmdW5jdGlvbiAod3JpdGVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgcmV0dXJuIGZuKHdyaXRlciwgY29udGV4dCwgdGVtcGxhdGUpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc3ViUmVuZGVyc1tpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKHdyaXRlciwgY29udGV4dCwgdGVtcGxhdGUpIHtcbiAgICAgIHZhciBidWZmZXIgPSBcIlwiO1xuICAgICAgdmFyIHRva2VuLCBzZWN0aW9uVGV4dDtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRva2Vucy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgICBzd2l0Y2ggKHRva2VuWzBdKSB7XG4gICAgICAgIGNhc2UgXCIjXCI6XG4gICAgICAgICAgc2VjdGlvblRleHQgPSB0ZW1wbGF0ZS5zbGljZSh0b2tlblszXSwgdG9rZW5bNV0pO1xuICAgICAgICAgIGJ1ZmZlciArPSB3cml0ZXIuX3NlY3Rpb24odG9rZW5bMV0sIGNvbnRleHQsIHNlY3Rpb25UZXh0LCBzdWJSZW5kZXIoaSwgdG9rZW5bNF0sIHRlbXBsYXRlKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJeXCI6XG4gICAgICAgICAgYnVmZmVyICs9IHdyaXRlci5faW52ZXJ0ZWQodG9rZW5bMV0sIGNvbnRleHQsIHN1YlJlbmRlcihpLCB0b2tlbls0XSwgdGVtcGxhdGUpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIj5cIjpcbiAgICAgICAgICBidWZmZXIgKz0gd3JpdGVyLl9wYXJ0aWFsKHRva2VuWzFdLCBjb250ZXh0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIiZcIjpcbiAgICAgICAgICBidWZmZXIgKz0gd3JpdGVyLl9uYW1lKHRva2VuWzFdLCBjb250ZXh0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIm5hbWVcIjpcbiAgICAgICAgICBidWZmZXIgKz0gd3JpdGVyLl9lc2NhcGVkKHRva2VuWzFdLCBjb250ZXh0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcInRleHRcIjpcbiAgICAgICAgICBidWZmZXIgKz0gdG9rZW5bMV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1zIHRoZSBnaXZlbiBhcnJheSBvZiBgdG9rZW5zYCBpbnRvIGEgbmVzdGVkIHRyZWUgc3RydWN0dXJlIHdoZXJlXG4gICAqIHRva2VucyB0aGF0IHJlcHJlc2VudCBhIHNlY3Rpb24gaGF2ZSB0d28gYWRkaXRpb25hbCBpdGVtczogMSkgYW4gYXJyYXkgb2ZcbiAgICogYWxsIHRva2VucyB0aGF0IGFwcGVhciBpbiB0aGF0IHNlY3Rpb24gYW5kIDIpIHRoZSBpbmRleCBpbiB0aGUgb3JpZ2luYWxcbiAgICogdGVtcGxhdGUgdGhhdCByZXByZXNlbnRzIHRoZSBlbmQgb2YgdGhhdCBzZWN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gbmVzdFRva2Vucyh0b2tlbnMpIHtcbiAgICB2YXIgdHJlZSA9IFtdO1xuICAgIHZhciBjb2xsZWN0b3IgPSB0cmVlO1xuICAgIHZhciBzZWN0aW9ucyA9IFtdO1xuXG4gICAgdmFyIHRva2VuO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0b2tlbnMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuICAgICAgc3dpdGNoICh0b2tlblswXSkge1xuICAgICAgY2FzZSAnIyc6XG4gICAgICBjYXNlICdeJzpcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgICAgY29sbGVjdG9yID0gdG9rZW5bNF0gPSBbXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcvJzpcbiAgICAgICAgdmFyIHNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcbiAgICAgICAgc2VjdGlvbls1XSA9IHRva2VuWzJdO1xuICAgICAgICBjb2xsZWN0b3IgPSBzZWN0aW9ucy5sZW5ndGggPiAwID8gc2VjdGlvbnNbc2VjdGlvbnMubGVuZ3RoIC0gMV1bNF0gOiB0cmVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJlZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21iaW5lcyB0aGUgdmFsdWVzIG9mIGNvbnNlY3V0aXZlIHRleHQgdG9rZW5zIGluIHRoZSBnaXZlbiBgdG9rZW5zYCBhcnJheVxuICAgKiB0byBhIHNpbmdsZSB0b2tlbi5cbiAgICovXG4gIGZ1bmN0aW9uIHNxdWFzaFRva2Vucyh0b2tlbnMpIHtcbiAgICB2YXIgc3F1YXNoZWRUb2tlbnMgPSBbXTtcblxuICAgIHZhciB0b2tlbiwgbGFzdFRva2VuO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0b2tlbnMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuICAgICAgaWYgKHRva2VuWzBdID09PSAndGV4dCcgJiYgbGFzdFRva2VuICYmIGxhc3RUb2tlblswXSA9PT0gJ3RleHQnKSB7XG4gICAgICAgIGxhc3RUb2tlblsxXSArPSB0b2tlblsxXTtcbiAgICAgICAgbGFzdFRva2VuWzNdID0gdG9rZW5bM107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsYXN0VG9rZW4gPSB0b2tlbjtcbiAgICAgICAgc3F1YXNoZWRUb2tlbnMucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNxdWFzaGVkVG9rZW5zO1xuICB9XG5cbiAgZnVuY3Rpb24gZXNjYXBlVGFncyh0YWdzKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIG5ldyBSZWdFeHAoZXNjYXBlUmUodGFnc1swXSkgKyBcIlxcXFxzKlwiKSxcbiAgICAgIG5ldyBSZWdFeHAoXCJcXFxccypcIiArIGVzY2FwZVJlKHRhZ3NbMV0pKVxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICogQnJlYWtzIHVwIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHN0cmluZyBpbnRvIGEgdHJlZSBvZiB0b2tlbiBvYmplY3RzLiBJZlxuICAgKiBgdGFnc2AgaXMgZ2l2ZW4gaGVyZSBpdCBtdXN0IGJlIGFuIGFycmF5IHdpdGggdHdvIHN0cmluZyB2YWx1ZXM6IHRoZVxuICAgKiBvcGVuaW5nIGFuZCBjbG9zaW5nIHRhZ3MgdXNlZCBpbiB0aGUgdGVtcGxhdGUgKGUuZy4gW1wiPCVcIiwgXCIlPlwiXSkuIE9mXG4gICAqIGNvdXJzZSwgdGhlIGRlZmF1bHQgaXMgdG8gdXNlIG11c3RhY2hlcyAoaS5lLiBNdXN0YWNoZS50YWdzKS5cbiAgICovXG4gIGV4cG9ydHMucGFyc2UgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlIHx8ICcnO1xuICAgIHRhZ3MgPSB0YWdzIHx8IGV4cG9ydHMudGFncztcblxuICAgIGlmICh0eXBlb2YgdGFncyA9PT0gJ3N0cmluZycpIHRhZ3MgPSB0YWdzLnNwbGl0KHNwYWNlUmUpO1xuICAgIGlmICh0YWdzLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHRhZ3M6ICcgKyB0YWdzLmpvaW4oJywgJykpO1xuICAgIH1cblxuICAgIHZhciB0YWdSZXMgPSBlc2NhcGVUYWdzKHRhZ3MpO1xuICAgIHZhciBzY2FubmVyID0gbmV3IFNjYW5uZXIodGVtcGxhdGUpO1xuXG4gICAgdmFyIHNlY3Rpb25zID0gW107ICAgICAvLyBTdGFjayB0byBob2xkIHNlY3Rpb24gdG9rZW5zXG4gICAgdmFyIHRva2VucyA9IFtdOyAgICAgICAvLyBCdWZmZXIgdG8gaG9sZCB0aGUgdG9rZW5zXG4gICAgdmFyIHNwYWNlcyA9IFtdOyAgICAgICAvLyBJbmRpY2VzIG9mIHdoaXRlc3BhY2UgdG9rZW5zIG9uIHRoZSBjdXJyZW50IGxpbmVcbiAgICB2YXIgaGFzVGFnID0gZmFsc2U7ICAgIC8vIElzIHRoZXJlIGEge3t0YWd9fSBvbiB0aGUgY3VycmVudCBsaW5lP1xuICAgIHZhciBub25TcGFjZSA9IGZhbHNlOyAgLy8gSXMgdGhlcmUgYSBub24tc3BhY2UgY2hhciBvbiB0aGUgY3VycmVudCBsaW5lP1xuXG4gICAgLy8gU3RyaXBzIGFsbCB3aGl0ZXNwYWNlIHRva2VucyBhcnJheSBmb3IgdGhlIGN1cnJlbnQgbGluZVxuICAgIC8vIGlmIHRoZXJlIHdhcyBhIHt7I3RhZ319IG9uIGl0IGFuZCBvdGhlcndpc2Ugb25seSBzcGFjZS5cbiAgICBmdW5jdGlvbiBzdHJpcFNwYWNlKCkge1xuICAgICAgaWYgKGhhc1RhZyAmJiAhbm9uU3BhY2UpIHtcbiAgICAgICAgd2hpbGUgKHNwYWNlcy5sZW5ndGgpIHtcbiAgICAgICAgICB0b2tlbnMuc3BsaWNlKHNwYWNlcy5wb3AoKSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwYWNlcyA9IFtdO1xuICAgICAgfVxuXG4gICAgICBoYXNUYWcgPSBmYWxzZTtcbiAgICAgIG5vblNwYWNlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHN0YXJ0LCB0eXBlLCB2YWx1ZSwgY2hyO1xuICAgIHdoaWxlICghc2Nhbm5lci5lb3MoKSkge1xuICAgICAgc3RhcnQgPSBzY2FubmVyLnBvcztcbiAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwodGFnUmVzWzBdKTtcblxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgIGNociA9IHZhbHVlLmNoYXJBdChpKTtcblxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoY2hyKSkge1xuICAgICAgICAgICAgc3BhY2VzLnB1c2godG9rZW5zLmxlbmd0aCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0b2tlbnMucHVzaChbXCJ0ZXh0XCIsIGNociwgc3RhcnQsIHN0YXJ0ICsgMV0pO1xuICAgICAgICAgIHN0YXJ0ICs9IDE7XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBcIlxcblwiKSB7XG4gICAgICAgICAgICBzdHJpcFNwYWNlKCk7IC8vIENoZWNrIGZvciB3aGl0ZXNwYWNlIG9uIHRoZSBjdXJyZW50IGxpbmUuXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHN0YXJ0ID0gc2Nhbm5lci5wb3M7XG5cbiAgICAgIC8vIE1hdGNoIHRoZSBvcGVuaW5nIHRhZy5cbiAgICAgIGlmICghc2Nhbm5lci5zY2FuKHRhZ1Jlc1swXSkpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGhhc1RhZyA9IHRydWU7XG4gICAgICB0eXBlID0gc2Nhbm5lci5zY2FuKHRhZ1JlKSB8fCBcIm5hbWVcIjtcblxuICAgICAgLy8gU2tpcCBhbnkgd2hpdGVzcGFjZSBiZXR3ZWVuIHRhZyBhbmQgdmFsdWUuXG4gICAgICBzY2FubmVyLnNjYW4od2hpdGVSZSk7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIHRhZyB2YWx1ZS5cbiAgICAgIGlmICh0eXBlID09PSBcIj1cIikge1xuICAgICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKGVxUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oZXFSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhblVudGlsKHRhZ1Jlc1sxXSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwie1wiKSB7XG4gICAgICAgIHZhciBjbG9zZVJlID0gbmV3IFJlZ0V4cChcIlxcXFxzKlwiICsgZXNjYXBlUmUoXCJ9XCIgKyB0YWdzWzFdKSk7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2VSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihjdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwodGFnUmVzWzFdKTtcbiAgICAgICAgdHlwZSA9IFwiJlwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbCh0YWdSZXNbMV0pO1xuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgY2xvc2luZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2Nhbih0YWdSZXNbMV0pKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgdGFnIGF0ICcgKyBzY2FubmVyLnBvcyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIHNlY3Rpb24gbmVzdGluZy5cbiAgICAgIGlmICh0eXBlID09PSAnLycpIHtcbiAgICAgICAgaWYgKHNlY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5vcGVuZWQgc2VjdGlvbiBcIicgKyB2YWx1ZSArICdcIiBhdCAnICsgc3RhcnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcblxuICAgICAgICBpZiAoc2VjdGlvblsxXSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgc2VjdGlvblsxXSArICdcIiBhdCAnICsgc3RhcnQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciB0b2tlbiA9IFt0eXBlLCB2YWx1ZSwgc3RhcnQsIHNjYW5uZXIucG9zXTtcbiAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgaWYgKHR5cGUgPT09ICcjJyB8fCB0eXBlID09PSAnXicpIHtcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwibmFtZVwiIHx8IHR5cGUgPT09IFwie1wiIHx8IHR5cGUgPT09IFwiJlwiKSB7XG4gICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCI9XCIpIHtcbiAgICAgICAgLy8gU2V0IHRoZSB0YWdzIGZvciB0aGUgbmV4dCB0aW1lIGFyb3VuZC5cbiAgICAgICAgdGFncyA9IHZhbHVlLnNwbGl0KHNwYWNlUmUpO1xuXG4gICAgICAgIGlmICh0YWdzLmxlbmd0aCAhPT0gMikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWdzIGF0ICcgKyBzdGFydCArICc6ICcgKyB0YWdzLmpvaW4oJywgJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFnUmVzID0gZXNjYXBlVGFncyh0YWdzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhlcmUgYXJlIG5vIG9wZW4gc2VjdGlvbnMgd2hlbiB3ZSdyZSBkb25lLlxuICAgIHZhciBzZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG4gICAgaWYgKHNlY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgc2VjdGlvbiBcIicgKyBzZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzY2FubmVyLnBvcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5lc3RUb2tlbnMoc3F1YXNoVG9rZW5zKHRva2VucykpO1xuICB9O1xuXG4gIC8vIFRoZSBoaWdoLWxldmVsIGNsZWFyQ2FjaGUsIGNvbXBpbGUsIGNvbXBpbGVQYXJ0aWFsLCBhbmQgcmVuZGVyIGZ1bmN0aW9uc1xuICAvLyB1c2UgdGhpcyBkZWZhdWx0IHdyaXRlci5cbiAgdmFyIF93cml0ZXIgPSBuZXcgV3JpdGVyKCk7XG5cbiAgLyoqXG4gICAqIENsZWFycyBhbGwgY2FjaGVkIHRlbXBsYXRlcyBhbmQgcGFydGlhbHMgaW4gdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgZXhwb3J0cy5jbGVhckNhY2hlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfd3JpdGVyLmNsZWFyQ2FjaGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGlsZXMgdGhlIGdpdmVuIGB0ZW1wbGF0ZWAgdG8gYSByZXVzYWJsZSBmdW5jdGlvbiB1c2luZyB0aGUgZGVmYXVsdFxuICAgKiB3cml0ZXIuXG4gICAqL1xuICBleHBvcnRzLmNvbXBpbGUgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICByZXR1cm4gX3dyaXRlci5jb21waWxlKHRlbXBsYXRlLCB0YWdzKTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGlsZXMgdGhlIHBhcnRpYWwgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVgIGFuZCBgdGVtcGxhdGVgIHRvIGEgcmV1c2FibGVcbiAgICogZnVuY3Rpb24gdXNpbmcgdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgZXhwb3J0cy5jb21waWxlUGFydGlhbCA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZSwgdGFncykge1xuICAgIHJldHVybiBfd3JpdGVyLmNvbXBpbGVQYXJ0aWFsKG5hbWUsIHRlbXBsYXRlLCB0YWdzKTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGlsZXMgdGhlIGdpdmVuIGFycmF5IG9mIHRva2VucyAodGhlIG91dHB1dCBvZiBhIHBhcnNlKSB0byBhIHJldXNhYmxlXG4gICAqIGZ1bmN0aW9uIHVzaW5nIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIGV4cG9ydHMuY29tcGlsZVRva2VucyA9IGZ1bmN0aW9uICh0b2tlbnMsIHRlbXBsYXRlKSB7XG4gICAgcmV0dXJuIF93cml0ZXIuY29tcGlsZVRva2Vucyh0b2tlbnMsIHRlbXBsYXRlKTtcbiAgfTtcblxuICAvKipcbiAgICogUmVuZGVycyB0aGUgYHRlbXBsYXRlYCB3aXRoIHRoZSBnaXZlbiBgdmlld2AgYW5kIGBwYXJ0aWFsc2AgdXNpbmcgdGhlXG4gICAqIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgZXhwb3J0cy5yZW5kZXIgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgcmV0dXJuIF93cml0ZXIucmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyk7XG4gIH07XG5cbiAgLy8gVGhpcyBpcyBoZXJlIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIDAuNC54LlxuICBleHBvcnRzLnRvX2h0bWwgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzLCBzZW5kKSB7XG4gICAgdmFyIHJlc3VsdCA9IGV4cG9ydHMucmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyk7XG5cbiAgICBpZiAodHlwZW9mIHNlbmQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgc2VuZChyZXN1bHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gZXhwb3J0cztcblxufSgpKSkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHRoaXMuZGVmYXVsdEVxdWFscyA9IHRydWU7IC8vIElmIHdlIGNhbid0IGZpbmQgYSB2YWxpZCBoYW5kbGVyIGRlZmF1bHQgdG8ga2V5PT12YWwgYmVoYXZpb3VyIChpLmUuIHsnZm9vJzogJ2Jhcid9IHRlc3RzIHRoYXQgdGhlIGtleSAnZm9vJyBpcyB0aGUgdmFsdWUgJ2JhcicpXG5cdHRoaXMuc2lsZW50ID0gZmFsc2U7IC8vIFNodXQgdXAgaWYgd2UgY2FudCBmaW5kIGEgc3VpdGFibGUgaGFuZGxlclxuXG5cdHRoaXMuaGFuZGxlcnMgPSBbXTtcblxuXHR0aGlzLm15RmlsdGVyID0gbnVsbDtcblx0dGhpcy5teURhdGEgPSBudWxsO1xuXHR0aGlzLm15TGltaXQgPSBudWxsO1xuXHR0aGlzLm15V2FudEFycmF5ID0gZmFsc2U7XG5cblx0dGhpcy5pbml0ID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgPXsxLDJ9JC8sIGZ1bmN0aW9uKGtleSwgdmFsLCBkYXRhKSB7IC8vIHsnZm9vID0nOiAnYmFyJ30gb3Igeydmb28gPT0nOiAnYmFyJ31cblx0XHRcdHJldHVybiAoZGF0YVtrZXldID09IHZhbCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgPiQvLCBmdW5jdGlvbihrZXksIHZhbCwgZGF0YSkgeyAvLyB7J2ZvbyA+JzogJ2Jhcid9XG5cdFx0XHRyZXR1cm4gKGRhdGFba2V5XSA+IHZhbCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgPCQvLCBmdW5jdGlvbihrZXksIHZhbCwgZGF0YSkgeyAvLyB7J2ZvbyA8JzogJ2Jhcid9XG5cdFx0XHRyZXR1cm4gKGRhdGFba2V5XSA8IHZhbCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgKD86Pj18PT4pJC8sIGZ1bmN0aW9uKGtleSwgdmFsLCBkYXRhKSB7IC8vIHsnZm9vID49JzogJ2Jhcid9IChvciAnPT4nKVxuXHRcdFx0cmV0dXJuIChkYXRhW2tleV0gPj0gdmFsKTtcblx0XHR9KTtcblx0XHR0aGlzLmFkZEhhbmRsZXIoL14oLio/KSAoPzo8PXw9PCkkLywgZnVuY3Rpb24oa2V5LCB2YWwsIGRhdGEpIHsgLy8geydmb28gPD0nOiAnYmFyJ30gb3IgKCc9PCcpXG5cdFx0XHRyZXR1cm4gKGRhdGFba2V5XSA8PSB2YWwpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdC8vIFNpbXBsZSBzZXR0ZXJzIHt7e1xuXHR0aGlzLmZpbHRlciA9IGZ1bmN0aW9uKGZpbHRlcikge1xuXHRcdHRoaXMubXlGaWx0ZXIgPSBmaWx0ZXI7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dGhpcy5kYXRhID0gZnVuY3Rpb24oZGF0YSkge1xuXHRcdHRoaXMubXlEYXRhID0gZGF0YTtcblx0XHRyZXR1cm4gdGhpcztcblx0fTtcblxuXHR0aGlzLmxpbWl0ID0gZnVuY3Rpb24obGltaXQpIHtcblx0XHR0aGlzLm15TGltaXQgPSBsaW1pdDtcblx0XHRyZXR1cm4gdGhpcztcblx0fTtcblxuXHR0aGlzLndhbnRBcnJheSA9IGZ1bmN0aW9uKHdhbnRBcnJheSkge1xuXHRcdHRoaXMubXlXYW50QXJyYXkgPSB3YW50QXJyYXkgPT09IHVuZGVmaW5lZCA/IHRydWUgOiB3YW50QXJyYXk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cdC8vIH19fVxuXG5cdHRoaXMucmVzZXQgPSBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm15RGF0YSA9IG51bGw7XG5cdFx0dGhpcy5teUZpbHRlciA9IG51bGw7XG5cdFx0dGhpcy5teVdhbnRBcnJheSA9IGZhbHNlO1xuXHRcdHRoaXMubXlMaW1pdCA9IDA7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dGhpcy5hZGRIYW5kbGVyID0gZnVuY3Rpb24ocmUsIGNhbGxiYWNrKSB7XG5cdFx0dGhpcy5oYW5kbGVycy5wdXNoKFtyZSwgY2FsbGJhY2tdKTtcblx0fTtcblxuXHR0aGlzLmV4ZWMgPSBmdW5jdGlvbihmaWx0ZXIsIGRhdGEsIGxpbWl0KSB7XG5cdFx0dmFyIG91dCA9IHRoaXMubXlXYW50QXJyYXkgPyBbXSA6IHt9O1xuXHRcdHZhciBmb3VuZCA9IDA7XG5cdFx0aWYgKCFmaWx0ZXIpXG5cdFx0XHRmaWx0ZXIgPSB0aGlzLm15RmlsdGVyO1xuXHRcdGlmICghZGF0YSlcblx0XHRcdGRhdGEgPSB0aGlzLm15RGF0YTtcblx0XHRpZiAoIWxpbWl0KVxuXHRcdFx0bGltaXQgPSB0aGlzLm15TGltaXQ7XG5cblx0XHRmb3IgKHZhciBpZCBpbiBkYXRhKSB7XG5cdFx0XHR2YXIgcm93ID0gZGF0YVtpZF07XG5cdFx0XHRpZiAodGhpcy5tYXRjaGVzKGZpbHRlciwgcm93KSkge1xuXHRcdFx0XHRpZiAodGhpcy5teVdhbnRBcnJheSkge1xuXHRcdFx0XHRcdG91dC5wdXNoKHJvdyk7XG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdG91dFtpZF0gPSByb3c7XG5cblx0XHRcdFx0aWYgKGxpbWl0ICYmICsrZm91bmQgPj0gbGltaXQpXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXQ7XG5cdH07XG5cblx0dGhpcy5tYXRjaGVzID0gZnVuY3Rpb24oZmlsdGVyLCBkYXRhKSB7XG5cdFx0Zm9yICh2YXIga2V5IGluIGZpbHRlcikge1xuXHRcdFx0dmFyIGhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdGZvciAodmFyIGggaW4gdGhpcy5oYW5kbGVycykge1xuXHRcdFx0XHR2YXIgbWF0Y2hlcztcblx0XHRcdFx0aWYgKG1hdGNoZXMgPSB0aGlzLmhhbmRsZXJzW2hdWzBdLmV4ZWMoa2V5KSkgeyAvLyBVc2UgdGhpcyBoYW5kbGVyXG5cdFx0XHRcdFx0aGFuZGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0aWYgKHRoaXMuaGFuZGxlcnNbaF1bMV0obWF0Y2hlc1sxXSwgZmlsdGVyW2tleV0sIGRhdGEpKSB7XG5cdFx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZygnT0snKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFoYW5kbGVkKVxuXHRcdFx0XHRpZiAodGhpcy5kZWZhdWx0RXF1YWxzKSB7XG5cdFx0XHRcdFx0aWYgKGRhdGFba2V5XSAhPSBmaWx0ZXJba2V5XSlcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuc2lsZW50KVxuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBmaWx0ZXIgbWF0Y2hpbmcgaW5jb21taW5nIHN0cmluZyBcIicgKyBrZXkgKyAnXCIuIERlZmF1bHRpbmcgdG8gbm8tbWF0Y2gnKTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH07XG5cblx0dGhpcy5pbml0KCk7XG59XG4iLCJ2YXIgZ2xvYmFsPXNlbGY7LyoqXG4qIEJhdHRcbiogRm9ybSBhbmQgZGF0YSBtYW5pcHVsYXRpb24gbGlicmFyeVxuKlxuKiBAdXJsIGh0dHBzOi8vZ2l0aHViLmNvbS9Nb21zRnJpZW5kbHlEZXZDby9CYXR0XG4qIEBhdXRob3IgTWF0dCBDYXJ0ZXIgPG1AdHRjYXJ0ZXIuY29tPlxuKiBAbGljZW5zZSBDQy1BdHRyaWJ1dGlvbi1Ob25Db21tZXJjaWFsLU5vRGVyaXZzIDMuMCBVbnBvcnRlZFxuKiBAbGljZW5zZVVSTCBodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9saWNlbnNlcy9ieS1uYy1uZC8zLjAvXG4qL1xuXG4vLyBSRVFVSVJFIC0gQmF0dCBvYmplY3RzIHt7e1xudmFyIGJhdHRfb2JqZWN0ID0gcmVxdWlyZSgnLi9iYXR0X29iamVjdC5qcycpO1xuXG52YXIgYmF0dF9kYXRlID0gcmVxdWlyZSgnLi9iYXR0X2RhdGUuanMnKTtcbmJhdHRfZGF0ZS5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2Nob2ljZSA9IHJlcXVpcmUoJy4vYmF0dF9jaG9pY2UuanMnKTtcbmJhdHRfY2hvaWNlLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xudmFyIGJhdHRfY2hvaWNlX3JhZGlvID0gcmVxdWlyZSgnLi9iYXR0X2Nob2ljZV9yYWRpby5qcycpO1xuYmF0dF9jaG9pY2VfcmFkaW8ucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9jb250YWluZXIgPSByZXF1aXJlKCcuL2JhdHRfY29udGFpbmVyLmpzJyk7XG5iYXR0X2NvbnRhaW5lci5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2NvbnRhaW5lcl9zcGxpdHRlciA9IHJlcXVpcmUoJy4vYmF0dF9jb250YWluZXJfc3BsaXR0ZXIuanMnKTtcbmJhdHRfY29udGFpbmVyX3NwbGl0dGVyLnByb3RvdHlwZSA9IG5ldyBiYXR0X2NvbnRhaW5lcigpO1xuXG52YXIgYmF0dF9mZWVkID0gcmVxdWlyZSgnLi9iYXR0X2ZlZWQuanMnKTtcbmJhdHRfZmVlZC5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcbnZhciBiYXR0X2ZlZWRfYmF0dCA9IHJlcXVpcmUoJy4vYmF0dF9mZWVkX2JhdHQuanMnKTtcbmJhdHRfZmVlZF9iYXR0LnByb3RvdHlwZSA9IG5ldyBiYXR0X2ZlZWQoKTtcblxudmFyIGJhdHRfZHJvcGRvd24gPSByZXF1aXJlKCcuL2JhdHRfZHJvcGRvd24uanMnKTtcbmJhdHRfZHJvcGRvd24ucHJvdG90eXBlID0gbmV3IGJhdHRfY29udGFpbmVyKCk7XG52YXIgYmF0dF9mb3JtID0gcmVxdWlyZSgnLi9iYXR0X2Zvcm0uanMnKTtcbmJhdHRfZm9ybS5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcbnZhciBiYXR0X3JlZmVyZW5jZSA9IHJlcXVpcmUoJy4vYmF0dF9yZWZlcmVuY2UuanMnKTtcbmJhdHRfcmVmZXJlbmNlLnByb3RvdHlwZSA9IG5ldyBiYXR0X2NvbnRhaW5lcigpO1xudmFyIGJhdHRfdGFibGUgPSByZXF1aXJlKCcuL2JhdHRfdGFibGUuanMnKTtcbmJhdHRfdGFibGUucHJvdG90eXBlID0gbmV3IGJhdHRfY29udGFpbmVyKCk7XG52YXIgYmF0dF90YWJzID0gcmVxdWlyZSgnLi9iYXR0X3RhYnMuanMnKTtcbmJhdHRfdGFicy5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcblxudmFyIGJhdHRfaW5wdXQgPSByZXF1aXJlKCcuL2JhdHRfaW5wdXQuanMnKTtcbmJhdHRfaW5wdXQucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9sYWJlbCA9IHJlcXVpcmUoJy4vYmF0dF9sYWJlbC5qcycpO1xuYmF0dF9sYWJlbC5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X3N0cmluZyA9IHJlcXVpcmUoJy4vYmF0dF9zdHJpbmcuanMnKTtcbmJhdHRfc3RyaW5nLnByb3RvdHlwZSA9IG5ldyBiYXR0X2lucHV0KCk7XG52YXIgYmF0dF9udW1iZXIgPSByZXF1aXJlKCcuL2JhdHRfbnVtYmVyLmpzJyk7XG5iYXR0X251bWJlci5wcm90b3R5cGUgPSBuZXcgYmF0dF9pbnB1dCgpO1xudmFyIGJhdHRfdGV4dCA9IHJlcXVpcmUoJy4vYmF0dF90ZXh0LmpzJyk7XG5iYXR0X3RleHQucHJvdG90eXBlID0gbmV3IGJhdHRfaW5wdXQoKTtcblxudmFyIGJhdHRfZmlsZSA9IHJlcXVpcmUoJy4vYmF0dF9maWxlLmpzJyk7XG5iYXR0X2ZpbGUucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9oZWFkaW5nID0gcmVxdWlyZSgnLi9iYXR0X2hlYWRpbmcuanMnKTtcbmJhdHRfaGVhZGluZy5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2h0bWwgPSByZXF1aXJlKCcuL2JhdHRfaHRtbC5qcycpO1xuYmF0dF9odG1sLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xuXG52YXIgYmF0dF9saW5rID0gcmVxdWlyZSgnLi9iYXR0X2xpbmsuanMnKTtcbmJhdHRfbGluay5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2J1dHRvbiA9IHJlcXVpcmUoJy4vYmF0dF9idXR0b24uanMnKTtcbmJhdHRfYnV0dG9uLnByb3RvdHlwZSA9IG5ldyBiYXR0X2xpbmsoKTtcbnZhciBiYXR0X3RhZyA9IHJlcXVpcmUoJy4vYmF0dF90YWcuanMnKTtcbmJhdHRfdGFnLnByb3RvdHlwZSA9IG5ldyBiYXR0X2xpbmsoKTtcblxudmFyIGJhdHRfdW5rbm93biA9IHJlcXVpcmUoJy4vYmF0dF91bmtub3duLmpzJyk7XG5iYXR0X3Vua25vd24ucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG4vLyB9fX1cbi8vIFJFUVVJUkUgLSBUaGlyZCBwYXJ0eSBtb2R1bGVzIHt7e1xudmFyIE11c3RhY2hlID0gcmVxdWlyZSgnbXVzdGFjaGUnKTtcbi8vIH19fVxuXG5nbG9iYWwuYmF0dCA9IHtcblx0ZGVidWc6IHRydWUsIC8vIFRoaXMgaXMgY2hhbmdlZCBkdXJpbmcgc2NyaXB0IGNvbXBpbGUgdG8gRkFMU0Vcblx0Zm9ybXM6IHt9LFxuXHR1c2VzUGF0aDogJycsIC8vIEFzc3VtZSBjdXJyZW50IGRpcmVjdG9yeSBpcyB3aGVyZSB3ZSBmaW5kICd1c2VzJyBtb2R1bGVzXG5cdGlzUmVhZHk6IGZhbHNlLFxuXHRzZXRzOiBbXSxcblx0c3RvcDogZmFsc2UsXG5cblx0ZmVlZHM6IHt9LFxuXG5cdHdpZGdldHM6IHtcblx0XHRidXR0b246IHtpbmhlcml0czogJ2xpbmsnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9idXR0b24uanMnKX0sXG5cdFx0Y2hvaWNlOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jaG9pY2UuanMnKX0sXG5cdFx0Y2hvaWNlX3JhZGlvOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jaG9pY2VfcmFkaW8uanMnKX0sXG5cdFx0Y29udGFpbmVyOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jb250YWluZXIuanMnKX0sXG5cdFx0Y29udGFpbmVyX3NwbGl0dGVyOiB7aW5oZXJpdHM6ICdjb250YWluZXInLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jb250YWluZXJfc3BsaXR0ZXIuanMnKX0sXG5cdFx0ZGF0ZToge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZGF0ZS5qcycpfSxcblx0XHRkcm9wZG93bjoge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZHJvcGRvd24uanMnKX0sXG5cdFx0ZmVlZF9iYXR0OiB7aW5oZXJpdHM6ICdmZWVkJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZmVlZF9iYXR0LmpzJyl9LFxuXHRcdGZlZWQ6IHtpbmhlcml0czogJ2NvbnRhaW5lcicsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2ZlZWQuanMnKX0sXG5cdFx0ZmlsZToge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZmlsZS5qcycpfSxcblx0XHRmb3JtOiB7aW5oZXJpdHM6ICdjb250YWluZXInLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9mb3JtLmpzJyl9LFxuXHRcdGhlYWRpbmc6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2hlYWRpbmcuanMnKX0sXG5cdFx0aHRtbDoge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfaHRtbC5qcycpfSxcblx0XHRpbnB1dDoge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfaW5wdXQuanMnKX0sXG5cdFx0bGFiZWw6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2xhYmVsLmpzJyl9LFxuXHRcdGxpbms6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2xpbmsuanMnKX0sXG5cdFx0bnVtYmVyOiB7aW5oZXJpdHM6ICdpbnB1dCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X251bWJlci5qcycpfSxcblx0XHRvYmplY3Q6IHtvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9vYmplY3QuanMnKX0sXG5cdFx0cmVmZXJlbmNlOiB7aW5oZXJpdHM6ICdjb250YWluZXInLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9yZWZlcmVuY2UuanMnKX0sXG5cdFx0c3RyaW5nOiB7aW5oZXJpdHM6ICdpbnB1dCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X3N0cmluZy5qcycpfSxcblx0XHR0YWJsZToge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfdGFibGUuanMnKX0sXG5cdFx0dGFiczoge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfdGFicy5qcycpfSxcblx0XHR0YWc6IHtpbmhlcml0czogJ2xpbmsnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF90YWcuanMnKX0sXG5cdFx0dGV4dDoge2luaGVyaXRzOiAnaW5wdXQnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF90ZXh0LmpzJyl9LFxuXHRcdHVua25vd246IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X3Vua25vd24uanMnKX1cblx0fSxcblxuXHQvKipcblx0KiBWYXJpYWJsZXMgYXZhaWxhYmxlIHRvIG9iamVjdC5wYXJzZSgpXG5cdCogQHZhciBoYXNoXG5cdCovXG5cdHBhcnNlR2xvYmFsczoge1xuXHRcdC8qKlxuXHRcdCogRXh0cmFjdHMgYSBVUkwgc2VnbWVudCB1c2luZyBhIG1hbmdsZWQgdmVyc2lvbiBvZiBhIGdsb2Jcblx0XHQqIFxuXHRcdCogVG9rZW5zOlxuXHRcdCpcdC0gJyonIC0gTWF0Y2ggYW55IG51bWJlciBvZiBjaGFyYWN0ZXJzXG5cdFx0Klx0LSAnPycgLSBNYXRjaCBvbmUgY2hyYWN0ZXJcblx0XHQqXHQtICchJyAtIENhcHR1cmUgdGhpc1xuXHRcdCpcblx0XHQqIEV4YW1wbGVzOlxuXHRcdCpcdC0ge3sjdXJsfX0vdXNlcnMvIXt7L3VybH19XG5cdFx0Klx0LSB7eyN1cmx9fS9wYXRoL3RvL2Rpci8he3svdXJsfX1cblx0XHQqXHQtIHt7I3VybH19L3VzZXJzL3R5cGUvKiAvdXNlcmlkIXt7L3VybH19IChzcGFjZSBhZGRlZCBhZnRlciAnKicgc28gbm90IHRvIHVwc2V0IHN5bnRheCBwYXJzZXJzIHRoYXQgc2VlIGl0IGFzIGVuZC1vZi1jb21tZW50cylcblx0XHQqL1xuXHRcdHVybDogZnVuY3Rpb24odGV4dCwgcmVuZGVyKSB7IC8vIFVybCBleHRyYWN0b3IgZnVuY3Rpb24gLSBlLmcuIFxuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKHRleHQsIHJlbmRlcikge1xuXHRcdFx0XHR2YXIgcmVTdHIgPSB0ZXh0XG5cdFx0XHRcdFx0LnJlcGxhY2UoJyonLCAnPEZJTFRFUjpBTlk+Jylcblx0XHRcdFx0XHQucmVwbGFjZSgnPycsICc8RklMVEVSOk9ORT4nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCchJywgJzxGSUxURVI6Q0FQVFVSRT4nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKC8oWy4/KiteJFtcXF1cXC9cXFxcKCl7fXwtXSkvZywgXCJcXFxcJDFcIilcblx0XHRcdFx0XHQucmVwbGFjZSgnPEZJTFRFUjpBTlk+JywgJy4qJylcblx0XHRcdFx0XHQucmVwbGFjZSgnPEZJTFRFUjpPTkU+JywgJy4nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCc8RklMVEVSOkNBUFRVUkU+JywgJyguKiknKTtcblx0XHRcdFx0dmFyIHJlID0gbmV3IFJlZ0V4cChyZVN0cik7XG5cdFx0XHRcdHZhciBmb3VuZCA9IHJlLmV4ZWMoZG9jdW1lbnQubG9jYXRpb24ucGF0aG5hbWUpO1xuXHRcdFx0XHR2YXIgYml0ID0gZm91bmRbMV0gfHwgJyc7XG5cdFx0XHRcdHJldHVybiBiaXQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdHJlYWR5OiBmdW5jdGlvbigpIHtcblx0XHRjb25zb2xlLmxvZygnQkFUVCBSRUFEWScpO1xuXHRcdHRoaXMuaXNSZWFkeSA9IHRydWU7XG5cblx0XHQkLmVhY2godGhpcy5zZXRzLCBmdW5jdGlvbihpLCBzZXQpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdUcmlnZ2VyIGxvYWQgb2YnLCBzZXQpO1xuXHRcdFx0aWYgKHNldC5lbGVtZW50KSB7IC8vIExvYWQgaW50byBlbGVtZW50IGkuZS4gaW52b2tlICQoZWxlbWVudCkuYmF0dChjb250ZW50KVxuXHRcdFx0XHRzZXQuZWxlbWVudC5iYXR0KHNldC5jb250ZW50KTtcblx0XHRcdH0gZWxzZSAvLyBObyBlbGVtZW50IC0gcHJvYmFibHkgYW4gYW5vbnltb3VzIGxvYWQgKGkuZS4gYmF0dC5zZXQoY29udGVudCkpXG5cdFx0XHRcdGJhdHQuc2V0KHNldC5jb250ZW50KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuc2V0cyA9IFtdO1xuXHR9LFxuXG5cdG1ha2VPYmplY3Q6IGZ1bmN0aW9uKHR5cGUpIHtcblx0XHR2YXIgb2JqO1xuXHRcdHR5cGUgPSB0eXBlLnJlcGxhY2UoJy0nLCAnXycpO1xuXHRcdGlmICghYmF0dC53aWRnZXRzW3R5cGVdKSB7XG5cdFx0XHR0eXBlID0gJ3Vua25vd24nO1xuXHRcdFx0b2JqID0gbmV3IGJhdHQud2lkZ2V0c1t0eXBlXS5vYmplY3QoKTtcblx0XHRcdG9iai50eXBlRmFpbGVkID0gb2JqLnR5cGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9iaiA9IG5ldyBiYXR0LndpZGdldHNbdHlwZV0ub2JqZWN0KCk7XG5cdFx0fVxuXHRcdG9iai50eXBlID0gdHlwZTtcblx0XHRpZiAoYmF0dC53aWRnZXRzW3R5cGVdLmluaGVyaXRzKSB7XG5cdFx0XHR2YXIgcHJvdG8gPSBuZXcgYmF0dC53aWRnZXRzW2JhdHQud2lkZ2V0c1t0eXBlXS5pbmhlcml0c10ub2JqZWN0KCk7XG5cdFx0XHRvYmoucHJvdG90eXBlID0gcHJvdG87XG5cdFx0XHRvYmouc3VwZXIgPSBwcm90bztcblx0XHR9XG5cdFx0cmV0dXJuIG9iajtcblx0fSxcblxuXHQvKipcblx0KiBMb2FkIGEgQmF0dCBwbHVnaW4gZnJvbSBwbHVnaW5zLyRuYW1lLmpzXG5cdCogVGhpcyBpcyByZWFsbHkganVzdCBhIGR1bWIgd3JhcHBlciBmb3IgJHNjcmlwdCgpXG5cdCogQHBhcmFtIHN0cmluZ3xhcnJheSBuYW1lIEVpdGhlciBhIHNpbmdsZSBwbHVnaW4gdG8gbG9hZCBvciBhbiBhcnJheSBvZiBwbHVnaW5zIHRvIGxvYWRcblx0Ki9cblx0cGx1Z2luOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0aWYgKHR5cGVvZiBuYW1lID09ICdhcnJheScpIHsgLy8gR2l2ZW4gYW4gYXJyYXkgLSBvdmVybG9hZCB0byBpbmRpdmlkdWFsIGNhbGxzXG5cdFx0XHRmb3IgKHZhciBwIGluIG5hbWUpXG5cdFx0XHRcdGJhdHQucGx1Z2luKG5hbWVbcF0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmxvZygnQmF0dD4gTG9hZGluZyBwbHVnaW4gJywgbmFtZSk7XG5cdFx0XHQkc2NyaXB0KGJhdHQucGF0aCArICcvcGx1Z2lucy8nICsgbmFtZSArICcuanMnKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCogTG9hZCBnZW5lcmljIEJhdHQgc3BlYyBpbnRvIGFuIGFub255bW91cyBvYmplY3Rcblx0KiBUaGlzIHdpbGwgbmV2ZXIgYWN0dWFsbHkgYXBwZWFyLiBJdHMgbW9zdGx5IHVzZWQgdG8gbG9hZCBkYi10YWJsZSB3aWRnZXRzIGV0Y1xuXHQqIEBwYXJhbSBzdHJpbmcganNvbiBUaGUgQmF0dCBvYmplY3Qgc3BlYyB0byBsb2FkXG5cdCovXG5cdHNldDogZnVuY3Rpb24oanNvbikge1xuXHRcdHZhciBpZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2JhdHQtZm9ybS0nKTtcblx0XHRpZiAoYmF0dC5pc1JlYWR5KSB7XG5cdFx0XHRiYXR0LmZvcm1zW2lkXSA9IG5ldyBiYXR0X2Zvcm0oKTtcblx0XHRcdGJhdHQuZm9ybXNbaWRdLnR5cGUgPSAnZm9ybSc7XG5cdFx0XHRiYXR0LmZvcm1zW2lkXS5zZXQoanNvbik7XG5cdFx0fSBlbHNlIHsgLy8gTm90IHlldCByZWFkeVxuXHRcdFx0Y29uc29sZS5sb2coJ0JhdHQgbm90IHlldCByZWFkeS4gRGVmZXJlZCBsb2FkIGZvciBhbm9ueW1vdXMgb2JqZWN0JywgaWQpO1xuXHRcdFx0YmF0dC5zZXRzLnB1c2goe1xuXHRcdFx0XHRjb250ZW50OiBqc29uXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0sXG5cblx0ZmluZDogZnVuY3Rpb24oaWQpIHtcblx0XHRpZiAoYmF0dC5mb3Jtc1tpZF0pIC8vIElzIHRoZSBJRCBhbiBhY3R1YWwgZm9ybT9cblx0XHRcdHJldHVybiBiYXR0LmZvcm1zW2lkXTtcblxuXHRcdGZvciAodmFyIGYgaW4gYmF0dC5mb3JtcykgeyAvLyBOb3BlLiBSZWN1cnNlIGludG8gZWFjaCBmb3JtXG5cdFx0XHR2YXIgZm91bmQgPSBiYXR0LmZvcm1zW2ZdLmZpbmQoaWQpO1xuXHRcdFx0aWYgKGZvdW5kKVxuXHRcdFx0XHRyZXR1cm4gZm91bmQ7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQqIFNpbXBsZSB3cmFwcGVyIHRvIHJ1biBhIGZ1bmN0aW9uIG9uIEFMTCBiYXR0IG9iamVjdHNcblx0KiBUaGlzIGlzIHJlYWxseSBqdXN0IGEgZHVtYiB3cmFwcGVyIGZvciBydW5uaW5nIC5lYWNoQ2hpbGQgb24gYWxsIGl0ZW1zIGluIHRoZSBiYXR0LmZvcm1zIGhhc2hcblx0KiBAcGFyYW0gY2FsbGJhY2sgY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJ1bi4gQ2FsbGVkIGluIHRoZSBmb3JtYXQgZnVuY3Rpb24oKSB7fSBzZXR0aW5nICd0aGlzJyB0byB0aGUgY3VycmVudCBjb250ZXh0XG5cdCogQHBhcmFtIGhhc2ggb3B0aW9ucyBBIGhhc2ggb2Ygb3B0aW9ucyB0byB1c2Ugd2hlbiBmaWx0ZXJpbmdcblx0KiBAc2VlIGJhdHRfY29udGFpbmVyL2VhY2hDaGlsZCgpXG5cdCovXG5cdGVhY2hDaGlsZDogZnVuY3Rpb24oY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRmb3IgKHZhciBmIGluIGJhdHQuZm9ybXMpIHtcblx0XHRcdGlmIChiYXR0LmZvcm1zW2ZdLmVhY2hDaGlsZChjYWxsYmFjaywgb3B0aW9ucykgPT09IGZhbHNlKVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9LFxuXG5cdHN1Ym1pdDogZnVuY3Rpb24oKSB7XG5cdFx0Zm9yICh2YXIgZiBpbiBiYXR0LmZvcm1zKSB7XG5cdFx0XHRiYXR0LmZvcm1zW2ZdLnN1Ym1pdCgpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0KiBTY3JpcHRzIHRoYXQgbG9hZFNjcmlwdHMoKSBpcyB3YWl0aW5nIG9uLlxuXHQqIFRoZXNlIGFyZSB1c3VhbGx5IGZyb20gdGFncyBzcGVjaWZpZWQgdXNpbmcgJ3NyYz1cInBhdGhcIicgaW4gdGhlIHRhZ1xuXHQqIEBhY2Nlc3MgcHJpdmF0ZVxuXHQqL1xuXHRsb2FkU2NyaXB0c1NyYzoge30sXG5cblx0LyoqXG5cdCogU2NyaXB0cyB0aGF0IGFyZSB3YWl0aW5nIHRvIGxvYWQgZnJvbSB0aGlzIGRvY3VtZW50LlxuXHQqIFNpbWlsYXIgdG8gbG9hZFNjcmlwdHNTcmMgZXhjZXB0IHdlIGhhdmUgdGhlc2UgZnJvbSBpbmxpbmVcblx0KiBAYWNjZXNzIHByaXZhdGVcblx0Ki9cblx0bG9hZFNjcmlwdHNJbmxpbmU6IFtdLFxuXG5cdC8qKlxuXHQqIEluZm9ybWF0aW9uIGFib3V0IHRoZSBzY3JpcHQgY3VycmVudGx5IGJlaW5nIGV2YWwoKSdlZFxuXHQqIFRoaXMgaXMgdXNlZCBieSB0aGUgJCh3aW5kb3cpLm9uKCdlcnJvcicpIGhhbmRsZXIgdG8gZGlzcGxheSBhIG5pY2UgbWVzc2FnZSByYXRoZXIgdGhhbiBqdXN0IGdpdmluZyB1cFxuXHQqIEB2YXIgYXJyYXlcblx0KiBAYWNjZXNzIHByaXZhdGVcblx0Ki9cblx0ZXZhbEluZm86IG51bGwsXG5cblx0LyoqXG5cdCogUHJvY2VzcyBhbGwgPHNjcmlwdCB0eXBlPVwiYmF0dFwiIFtzcmM9XCJwYXRoXCJdLz4gdGFnc1xuXHQqL1xuXHRsb2FkU2NyaXB0czogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHJlYWR5ID0gMTtcblx0XHQkKCdzY3JpcHRbdHlwZT1cImJhdHRcIl0nKS5lYWNoKGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHNjcmlwdCA9ICQodGhpcyk7XG5cdFx0XHR2YXIgc2NyaXB0U3JjID0gc2NyaXB0LmF0dHIoJ3NyYycpO1xuXHRcdFx0aWYgKHNjcmlwdFNyYykgeyAvLyBIYXMgYW4gc3JjPVwicGF0aFwiIGF0dHJpYnV0ZVxuXHRcdFx0XHRpZiAoYmF0dC5sb2FkU2NyaXB0c1NyY1tzY3JpcHRTcmNdID09ICdsb2FkaW5nJykgeyAvLyBTdGlsbCB3YWl0aW5nIGZvciB0aGlzIHNjcmlwdCB0byBsb2FkXG5cdFx0XHRcdFx0cmVhZHkgPSAwO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGJhdHQubG9hZFNjcmlwdHNTcmNbc2NyaXB0U3JjXSA9PSAnbG9hZGVkJykgeyAvLyBMb2FkZWQgY29udGVudCAtIHRoaXMgc2NyaXB0IGlzIHJlYWR5XG5cdFx0XHRcdFx0Ly8gRG8gbm90aGluZ1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFiYXR0LmxvYWRTY3JpcHRzU3JjW3NjcmlwdFNyY10pIHsgLy8gRmlyc3QgbWVudGlvbiBvZiB0aGlzIHNjcmlwdCB3ZSd2ZSBzZWVuIC0gdHJpZ2dlciBBSkFYIGxvYWRcblx0XHRcdFx0XHRiYXR0LmxvYWRTY3JpcHRzU3JjW3NjcmlwdFNyY10gPSAnbG9hZGluZyc7XG5cdFx0XHRcdFx0JC5hamF4KHtcblx0XHRcdFx0XHRcdHVybDogc2NyaXB0U3JjLFxuXHRcdFx0XHRcdFx0ZGF0YVR5cGU6ICd0ZXh0Jyxcblx0XHRcdFx0XHRcdHR5cGU6ICdHRVQnLFxuXHRcdFx0XHRcdFx0ZGF0YToge25vaGVhZGVyczogMX0sXG5cdFx0XHRcdFx0XHRjYWNoZTogdHJ1ZSxcblx0XHRcdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKGh0bWwpIHtcblx0XHRcdFx0XHRcdFx0YmF0dC5sb2FkU2NyaXB0c1NyY1tzY3JpcHRTcmNdID0gJ2xvYWRlZCc7XG5cdFx0XHRcdFx0XHRcdHNjcmlwdC5yZXBsYWNlV2l0aChodG1sKTtcblx0XHRcdFx0XHRcdFx0YmF0dC5sb2FkU2NyaXB0cygpO1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGVycm9yOiBmdW5jdGlvbihqcXhociwgZXJyVGV4dCwgZXJyVGhyb3duKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignRXJyb3Igd2hpbGUgbG9hZGluZyA8c2NyaXB0IHNyYz1cIicgKyBzY3JpcHRTcmMgKyAnXCIvPicsIGVyclRleHQsIGVyclRocm93bik7IC8vIEZJWE1FOiBkZWFsIHdpdGggdGhpcyBncmFjZWZ1bGx5XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0cmVhZHkgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgeyAvLyBMb2FkIGZyb20gY29udGVudFxuXHRcdFx0XHR2YXIgbmV3SWQgPSBiYXR0LmdldFVuaXF1ZUlkKCdiYXR0LScpO1xuXHRcdFx0XHRzY3JpcHQuYmVmb3JlKCc8ZGl2IGlkPVwiJyArIG5ld0lkICsgJ1wiPjwvZGl2PicpXG5cdFx0XHRcdGJhdHQubG9hZFNjcmlwdHNJbmxpbmUucHVzaCgnJChcXCcjJyArIG5ld0lkICsgJ1xcJykuYmF0dCgnICsgc2NyaXB0Lmh0bWwoKSArICcpOycpO1xuXHRcdFx0XHRzY3JpcHQucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aWYgKHJlYWR5KSB7XG5cdFx0XHQkKHdpbmRvdykub24oJ2Vycm9yJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnQ0FVR0hUJywgZS5vcmlnaW5hbEV2ZW50LCBiYXR0LmV2YWxJbmZvKTtcblx0XHRcdFx0YmF0dC5zdG9wID0gMTtcblx0XHRcdFx0aWYgKGJhdHQuZXZhbEluZm8pIHsgLy8gV2UgaGF2ZSBzb21ldGhpbmcgdG8gY29tcGxhaW4gYWJvdXRcblx0XHRcdFx0XHR2YXIgYm94ID0gJChiYXR0LmV2YWxJbmZvLmlkKTtcblx0XHRcdFx0XHR2YXIgbWVzc2FnZSA9IGUub3JpZ2luYWxFdmVudC5tZXNzYWdlLnJlcGxhY2UoL15VbmNhdWdodCBTeW50YXhFcnJvcjogLywgJycpO1xuXHRcdFx0XHRcdHZhciBsaW5lID0gZS5vcmlnaW5hbEV2ZW50LmxpbmVubztcblx0XHRcdFx0XHRib3guYXBwZW5kKCc8ZGl2IGNsYXNzPVwiYWxlcnQgYWxlcnQtYmxvY2sgYWxlcnQtZXJyb3JcIj48aDM+QmF0dCBmYWlsZWQgdG8gbG9hZCAtICcgKyBtZXNzYWdlICsgKGxpbmUgPyAnIChMaW5lOiAnICsgbGluZSArICcpJyA6ICcnKSArICc8L2gzPjwvZGl2PicpO1xuXHRcdFx0XHRcdGlmIChsaW5lKSB7IC8vIFdlIGhhdmUgYSBzcGVjaWZpYyBsaW5lIG51bWJlciB0byBsb29rIGF0XG5cdFx0XHRcdFx0XHR2YXIgYmxvY2sgPSBiYXR0LmxvYWRTY3JpcHRzSW5saW5lW2JhdHQuZXZhbEluZm8ubG9hZFNjcmlwdHNJbmxpbmVPZmZzZXRdLnNwbGl0KFwiXFxuXCIpO1xuXHRcdFx0XHRcdFx0Ym94LmZpbmQoJ2Rpdi5hbGVydCcpXG5cdFx0XHRcdFx0XHRcdC5hcHBlbmQoJCgnPHByZT48L3ByZT4nKS50ZXh0KGJsb2NrLnNsaWNlKDAsIGxpbmUgLSAxKS5qb2luKFwiXFxuXCIpKSlcblx0XHRcdFx0XHRcdFx0LmFwcGVuZCgnPGRpdiBjbGFzcz1cImxhYmVsIGxhYmVsLXdhcm5pbmdcIj4nICsgbWVzc2FnZSArICc6PC9kaXY+Jylcblx0XHRcdFx0XHRcdFx0LmFwcGVuZCgkKCc8cHJlIGNsYXNzPVwiYWxlcnRcIj48L3ByZT4nKS50ZXh0KGJsb2NrLnNsaWNlKGxpbmUgLSAxLCBsaW5lKSkpXG5cdFx0XHRcdFx0XHRcdC5hcHBlbmQoJCgnPHByZT48L3ByZT4nKS50ZXh0KGJsb2NrLnNsaWNlKGxpbmUpLmpvaW4oXCJcXG5cIikpKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gZWxzZSB7IC8vIFdlIGhhdmUgbm8gaWRlYSB3aGVyZSB0aGUgZXJyb3Igb2NjdXJlZFxuXHRcdFx0XHRcdFx0Ym94LmZpbmQoJ2Rpdi5hbGVydCcpLmFwcGVuZChcblx0XHRcdFx0XHRcdFx0JCgnPHByZT48L3ByZT4nKS50ZXh0KGJhdHQubG9hZFNjcmlwdHNJbmxpbmVbYmF0dC5ldmFsSW5mby5sb2FkU2NyaXB0c0lubGluZU9mZnNldF0pXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRmb3IgKHZhciBpID0gYmF0dC5sb2FkU2NyaXB0c0lubGluZS5sZW5ndGggLSAxOyBpID4gLTE7IGktLSkge1xuXHRcdFx0XHR2YXIgbWF0Y2hlcyA9IC9cXCRcXCgnKC4qKSdcXClcXC5iYXR0XFwoLy5leGVjKGJhdHQubG9hZFNjcmlwdHNJbmxpbmVbaV0pO1xuXHRcdFx0XHRiYXR0LmV2YWxJbmZvID0ge1xuXHRcdFx0XHRcdGxvYWRTY3JpcHRzSW5saW5lT2Zmc2V0OiBpLFxuXHRcdFx0XHRcdGlkOiBtYXRjaGVzWzFdXG5cdFx0XHRcdH07XG5cdFx0XHRcdGV2YWwoYmF0dC5sb2FkU2NyaXB0c0lubGluZVtpXSk7XG5cdFx0XHR9XG5cdFx0XHRiYXR0LmV2YWxJbmZvID0gbnVsbDtcblx0XHRcdGJhdHQubG9hZFNjcmlwdHNJbmxpbmUgPSBbXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5sb2coJ0lubGluZSA8c2NyaXB0PiB0YWdzIHdhaXRpbmcgb24nLCBPYmplY3Qua2V5cyhiYXR0LmxvYWRTY3JpcHRzU3JjKSk7XG5cdFx0fVxuXHR9LFxuXG5cdC8vIFV0aWxpdHkgZnVuY3Rpb25zIHt7e1xuXHQvKipcblx0KiBQYXJzZSBhIE11c3RhY2hlIHRlbXBsYXRlXG5cdCogQHBhcmFtIHN0cmluZyBzdHJpbmcgVGhlIHN0cmluZyB0byBwYXJzZSBhbmQgcmV0dXJuXG5cdCogQHBhcmFtIG9iamVjdCBBZGRpdGlvbmFsIG9iamVjdCBkYXRhIHRvIGluY2x1ZGUgaW4gdGhlIHRlbXBsYXRlXG5cdCogQHJldHVybiBzdHJpbmcgVGhlIHBhcnNlZCBzdHJpbmdcblx0Ki9cblx0cGFyc2U6IGZ1bmN0aW9uKHN0cmluZywgZGF0YSkge1xuXHRcdHZhciBkYXRhID0gJC5leHRlbmQoe30sIGJhdHQucGFyc2VHbG9iYWxzLCBkYXRhKTtcblx0XHR2YXIgb3V0ID0gTXVzdGFjaGUucmVuZGVyKHN0cmluZywgZGF0YSk7XG5cdFx0Ly8gY29uc29sZS5sb2coJ0JBVFQuUEFSU0UnLCBzdHJpbmcsICc9Jywgb3V0LCBkYXRhKTtcblx0XHRyZXR1cm4gb3V0O1xuXHR9LFxuXG5cdC8qKlxuXHQqIFNhbml0aXplIGEgc3RyaW5nIGFuZCByZXR1cm4gdGhlIHNhZmUgdmVyc2lvbiBkZXZvaWQgb2YgYW55dGhpbmcgZGFuZ2Vyb3VzXG5cdCogQHBhcmFtIHN0cmluZyB2YWx1ZSBUaGUgc3RyaW5nIHRvIHNhbml0aXplXG5cdCogQHBhcmFtIHN0cmluZyBwcmVmaXggT3B0aW9uYWwgcHJlZml4IHRvIHByZXBlbmQgdG8gdGhlIG91dHB1dFxuXHQqIEByZXR1cm4gc3RyaW5nIFRoZSBzYWZlIHZlcnNpb24gb2YgdGhlIGlucHV0ICd2YWx1ZSdcblx0Ki9cblx0c2FmZVN0cmluZzogZnVuY3Rpb24odmFsdWUsIHByZWZpeCkge1xuXHRcdHJldHVybiAocHJlZml4P3ByZWZpeDonJykgKyB2YWx1ZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05XSsvZywgJy0nKTtcblx0fSxcblxuXHQvKipcblx0KiBSZXR1cm4gYSB1bmlxdWUgSUQgZm9yIGFuIGl0ZW0gYmFzZWQgb24gYSBwcmVmaXhcblx0KiBUaGlzIGlzIHVzdWFsbHkgdXNlZCB0byBhbGxvY2F0ZSBhbiBIVE1MIElEIHRvIGFuIGVsZW1lbnQgdGhhdCBkb2VzbnQgYWxyZWFkeSBoYXZlIG9uZVxuXHQqL1xuXHRnZXRVbmlxdWVJZDogZnVuY3Rpb24ocHJlZml4KSB7XG5cdFx0aWYgKCFwcmVmaXgpXG5cdFx0XHRwcmVmaXggPSAnYmF0dC0nO1xuXHRcdHdoaWxlICgxKSB7XG5cdFx0XHR2YXIgaWQgPSBwcmVmaXggKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqOTk5OTkpO1xuXHRcdFx0aWYgKCQoJyMnICsgaWQpLmxlbmd0aCA9PSAwKVxuXHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0fVxuXHR9XG5cdC8vIH19fVxufTtcblxuYmF0dC5yZWFkeSgpO1xuXG4kLmZuLmV4dGVuZCh7XG5cdGJhdHQ6IGZ1bmN0aW9uKGpzb24pIHtcblx0XHRyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gJCh0aGlzKTtcblx0XHRcdHZhciBpZCA9IG1lLmF0dHIoJ2lkJyk7XG5cdFx0XHR2YXIgY29udGVudCA9IGpzb24gfHwgbWUudGV4dCgpO1xuXHRcdFx0aWYgKCFpZCkgeyAvLyBNYWtlIHN1cmUgdGhlIGl0ZW0gaGFzIGFuIElEIC0gbWFrZSBvbmUgaWYgbmVjZXNzYXJ5XG5cdFx0XHRcdGlkID0gYmF0dC5nZXRVbmlxdWVJZCgnYmF0dC1mb3JtLScpO1xuXHRcdFx0XHRtZS5hdHRyKCdpZCcsIGlkKVxuXHRcdFx0fVxuXHRcdFx0aWYgKGJhdHQuaXNSZWFkeSkge1xuXHRcdFx0XHRiYXR0LmZvcm1zW2lkXSA9IGJhdHQubWFrZU9iamVjdCgnZm9ybScpO1xuXHRcdFx0XHRiYXR0LmZvcm1zW2lkXS5zZXQoY29udGVudCk7XG5cdFx0XHRcdGJhdHQuZm9ybXNbaWRdLmVsZW1lbnQgPSBtZTtcblx0XHRcdFx0YmF0dC5mb3Jtc1tpZF0uc2V0dXAuY2FsbChiYXR0LmZvcm1zW2lkXSk7XG5cdFx0XHRcdGJhdHQuZm9ybXNbaWRdLnJlbmRlci5jYWxsKGJhdHQuZm9ybXNbaWRdKTtcblx0XHRcdH0gZWxzZSB7IC8vIE5vdCB5ZXQgcmVhZHlcblx0XHRcdFx0Y29uc29sZS5sb2coJ0JhdHQgbm90IHlldCByZWFkeS4gRGVmZXJlZCBsb2FkIGZvciBmb3JtJywgaWQpO1xuXHRcdFx0XHRiYXR0LnNldHMucHVzaCh7XG5cdFx0XHRcdFx0ZWxlbWVudDogbWUsXG5cdFx0XHRcdFx0Y29udGVudDogY29udGVudFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufSk7XG5cbi8vIFRyaWdnZXIgaW5pdGlhbCBzd2VlcCBmb3IgPHNjcmlwdCB0eXBlPVwiYmF0dFwiLz4gdGFnc1xuJChiYXR0LmxvYWRTY3JpcHRzKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0Y29udGFpbmVyRHJhdzogJ2J1dHRvbnMnLFxuXHRcdGFjdGlvbjogJ25vdGhpbmcnLFxuXHRcdGNsYXNzZXM6ICdidG4nLFxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnJlbmRlci5jYWxsKHRoaXMpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzxzZWxlY3Q+PC9zZWxlY3Q+Jyxcblx0XHRjaG9pY2VzOiB7XG5cdFx0XHRmb286ICdGb28nLFxuXHRcdFx0YmFyOiAnQmFyJyxcblx0XHRcdGJhejogJ0Jheidcblx0XHR9LFxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5lbGVtZW50ID0gJChtZS5yZW5kZXJUYWcpO1xuXHRcdFx0bWUuZWxlbWVudC5vbignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdG1lLnZhbHVlID0gJCh0aGlzKS52YWwoKTtcblx0XHRcdFx0bWUuY2hhbmdlLmNhbGwobWUpO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpO1xuXHRcdFx0Zm9yICh2YXIgaWQgaW4gbWUuY2hvaWNlcykge1xuXHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZCgnPG9wdGlvbiB2YWx1ZT1cIicgKyBpZCArICdcIj4nICsgbWUuY2hvaWNlc1tpZF0gKyAnPC9vcHRpb24+Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtZS52YWx1ZSkge1xuXHRcdFx0XHRtZS5lbGVtZW50LnZhbChtZS52YWx1ZSk7XG5cdFx0XHR9IGVsc2UgeyAvLyBObyB2YWx1ZSAtIHNlbGVjdCB0aGUgZmlyc3Rcblx0XHRcdFx0bWUuZWxlbWVudFxuXHRcdFx0XHRcdC52YWwoIG1lLmVsZW1lbnQuZmluZCgnb3B0aW9uOmZpcnN0JykuYXR0cigndmFsdWUnKSApXG5cdFx0XHRcdFx0LnRyaWdnZXIoJ2NoYW5nZScpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzxkaXY+PC9kaXY+Jyxcblx0XHRjaG9pY2VzOiB7fSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuZW1wdHkoKTtcblx0XHRcdGZvciAodmFyIGlkIGluIHRoaXMuY2hvaWNlcykge1xuXHRcdFx0XHR2YXIgbGFiZWwgPSAkKCc8bGFiZWwgY2xhc3M9XCJyYWRpb1wiPjwvbGFiZWw+Jylcblx0XHRcdFx0XHQuYXBwZW5kVG8odGhpcy5lbGVtZW50KTtcblx0XHRcdFx0dmFyIHJhZGlvID0gJCgnPGlucHV0IHR5cGU9XCJyYWRpb1wiIG5hbWU9XCInICsgbWUuaWQgKyAnXCIgdmFsdWU9XCInICsgaWQgKyAnXCI+JyArIHRoaXMuY2hvaWNlc1tpZF0gKyAnPC9sYWJlbD4nKVxuXHRcdFx0XHRcdC5hcHBlbmRUbyhsYWJlbClcblx0XHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0bWUudmFsdWUgPSAkKHRoaXMpLnZhbCgpO1xuXHRcdFx0XHRcdFx0bWUuY2hhbmdlLmNhbGwobWUpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy52YWx1ZSlcblx0XHRcdFx0dGhpcy5lbGVtZW50LmZpbmQoJ2lucHV0W3ZhbHVlPVwiJyArIHRoaXMudmFsdWUgKyAnXCJdJykucHJvcCgnY2hlY2tlZCcsIHRydWUpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNoaWxkcmVuOiB7fSxcblx0XHRjaGlsZHJlbk9yZGVyOiBbXSxcblx0XHRjb250YWluZXJEcmF3OiAncm93Jyxcblx0XHRpbXBseUNoaWxkOiAndW5rbm93bicsIC8vIERlZmF1bHQgdG8gdGhpcyBpZiBubyBjaGlsZCB0eXBlIGlzIHNwZWNpZmllZFxuXHRcdGRhdGFTb3VyY2U6IG51bGwsIC8vIFdoYXQgZGF0YSBzb3VyY2UgdG8gdXNlICh1c3VhbGx5IGEgaGFzaCBzdHJ1Y3R1cmUpXG5cdFx0cmVuZGVyVGFnOiAnPGRpdj48L2Rpdj4nLCAvLyBXaGF0IHdyYXBwZXIgdG8gdXNlIHdoZW4gZHJhd2luZyB0aGUgY29udGFpbmVyXG5cdFx0Y2xhc3NlczogJycsXG5cblx0XHQvKipcblx0XHQqIFJ1bnMgYSBmdW5jdGlvbiBvbiBlYWNoIGNoaWxkIG9mIHRoaXMgY29udGFpbmVyXG5cdFx0KiBUaGlzIGZ1bmN0aW9uIGlzIHJlY3Vyc2l2ZS4gSWYgeW91IHJlcXVpcmUganVzdCB0aGUgaW1tZWRpYXRlIGNoaWxkcmVuIHVzZSAkLmVhY2goY29udGFpbmVyLmNoaWxkcmVuLCBmdW5jdGlvbigpIHsgfSlcblx0XHQqIEBwYXJhbSBjYWxsYmFjayBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuLiBDYWxsZWQgaW4gdGhlIGZvcm1hdCBmdW5jdGlvbigpIHt9IHNldHRpbmcgJ3RoaXMnIHRvIHRoZSBjdXJyZW50IGNvbnRleHRcblx0XHQqIEBwYXJhbSBoYXNoIG9wdGlvbnMgQSBoYXNoIG9mIG9wdGlvbnMgdG8gdXNlIHdoZW4gZmlsdGVyaW5nXG5cdFx0KiBAcGFyYW0gb2JqZWN0IG9iamVjdCBDb250ZXh0IG9iamVjdCAoaW50ZXJuYWwgdXNlIG9ubHkpXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdGVhY2hDaGlsZDogZnVuY3Rpb24oY2FsbGJhY2ssIG9wdGlvbnMsIGNvbnRleHQpIHtcblx0XHRcdGlmICghY29udGV4dClcblx0XHRcdFx0Y29udGV4dCA9IHRoaXM7XG5cdFx0XHRpZiAoIWNvbnRleHQuY2hpbGRyZW4pXG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0dmFyIHNldHRpbmdzID0gJC5leHRlbmQoe30sIHtcblx0XHRcdFx0YW5kU2VsZjogZmFsc2UsIC8vIEluY2x1ZGUgdGhpcyBpdGVtIGluIHRoZSBmaXJzdCBjYWxsYmFja1xuXHRcdFx0XHRkZXB0aEZpcnN0OiBmYWxzZSAvLyBUcmlnZ2VyIGNhbGxiYWNrcyBmcm9tIHRoZSBkZWVwZXN0IGZpcnN0XG5cdFx0XHR9LCBvcHRpb25zKTtcblxuXHRcdFx0aWYgKHNldHRpbmdzLmFuZFNlbGYgJiYgIXNldHRpbmdzLmRlcHRoRmlyc3QpXG5cdFx0XHRcdGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG5cblx0XHRcdGlmICghY29udGV4dC5jaGlsZHJlbk9yZGVyKVxuXHRcdFx0XHRjb250ZXh0LmNoaWxkcmVuT3JkZXIgPSBPYmplY3Qua2V5cyhjb250ZXh0LmNoaWxkcmVuKTtcblxuXHRcdFx0Zm9yICh2YXIgY2lkIGluIGNvbnRleHQuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHR2YXIgY2hpbGQgPSBjb250ZXh0LmNoaWxkcmVuW2NvbnRleHQuY2hpbGRyZW5PcmRlcltjaWRdXTtcblx0XHRcdFx0aWYgKCFzZXR0aW5ncy5kZXB0aEZpcnN0KVxuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwoY2hpbGQpO1xuXHRcdFx0XHRpZiAoY2hpbGQuY2hpbGRyZW4pXG5cdFx0XHRcdFx0dGhpcy5lYWNoQ2hpbGQuY2FsbChjaGlsZCwgY2FsbGJhY2ssIG9wdGlvbnMsIGNoaWxkKTtcblx0XHRcdFx0aWYgKHNldHRpbmdzLmRlcHRoRmlyc3QpXG5cdFx0XHRcdFx0Y2FsbGJhY2suY2FsbChjaGlsZCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoc2V0dGluZ3MuYW5kU2VsZiAmJiAhc2V0dGluZ3MuZGVwdGhGaXJzdClcblx0XHRcdFx0Y2FsbGJhY2suY2FsbChjb250ZXh0KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIExvY2F0ZSBhIG9iamVjdCBieSBpdHMgSUQgdW5kZXIgdGhpcyBvbmVcblx0XHQqIEBwYXJhbSBzdHJpbmcgaWQgVGhlIElEIG9mIHRoZSBvYmplY3QgdG8gZmluZFxuXHRcdCogQHBhcmFtIG9iamVjdCBjb250ZXh0IEludGVybmFsIHVzZSBvbmx5IC0gcHJvdmlkZSB0aGUgY29udGV4dCB0byBzY2FuXG5cdFx0KiBAcmV0dXJuIG51bGx8b2JqZWN0IEVpdGhlciB0aGUgZm91bmQgb2JqZWN0IG9yIG51bGxcblx0XHQqL1xuXHRcdGZpbmQ6IGZ1bmN0aW9uKGlkLCBjb250ZXh0KSB7XG5cdFx0XHRpZiAoIWNvbnRleHQpXG5cdFx0XHRcdGNvbnRleHQgPSB0aGlzO1xuXG5cdFx0XHRpZiAoIWNvbnRleHQuY2hpbGRyZW4pXG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0aWYgKGNvbnRleHQuY2hpbGRyZW5baWRdKVxuXHRcdFx0XHRyZXR1cm4gY29udGV4dC5jaGlsZHJlbltpZF07XG5cblx0XHRcdGZvciAodmFyIGMgaW4gY29udGV4dC5jaGlsZHJlbikge1xuXHRcdFx0XHR2YXIgZm91bmQgPSB0aGlzLmZpbmQoaWQsIGNvbnRleHQuY2hpbGRyZW5bY10pO1xuXHRcdFx0XHRpZiAoZm91bmQpXG5cdFx0XHRcdFx0cmV0dXJuIGZvdW5kO1xuXHRcdFx0fTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIEV4dHJhY3QgYWxsICd1c2VzJyBkaXJlY3RpdmVzIGZyb20gYSBjb21wbGV4bHkgbmVzdGVkIEpTT04gb2JqZWN0IGFuZCByZXR1cm4gYXMgYW4gYXJyYXlcblx0XHQqIEBwYXJhbSBvYmplY3QganNvbiBUaGUgbmVzdGVkIEpTT04gb2JqZWN0IHRvIHByb2Nlc3Ncblx0XHQqIEByZXR1cm4gYXJyYXkgQW4gYXJyYXkgb2YgYWxsIHVzZXMgZGlyZWN0aXZlc1xuXHRcdCovXG5cdFx0ZGV0ZXJtaW5lVXNlczogZnVuY3Rpb24oanNvbikge1xuXHRcdFx0dmFyIHVzZXMgPSB7fTtcblxuXHRcdFx0dmFyIHVzZXNXb3JrZXIgPSBmdW5jdGlvbihqc29uLCB1c2VzKSB7IFxuXHRcdFx0XHQkLmVhY2goanNvbiwgZnVuY3Rpb24oaSwgaikge1xuXHRcdFx0XHRcdGlmIChqLmNoaWxkcmVuKVxuXHRcdFx0XHRcdFx0dXNlc1dvcmtlcihqLmNoaWxkcmVuLCB1c2VzKVxuXHRcdFx0XHRcdGlmIChqLnVzZXMpXG5cdFx0XHRcdFx0XHR1c2VzW2oudXNlc10gPSAxO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dXNlc1dvcmtlcihqc29uLCB1c2VzKTtcblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyh1c2VzKTtcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBBZGQgYSBuZXcgYmF0dCBvYmplY3QgdG8gYSBjb250YWluZXJcblx0XHQqIE5PVEU6IFRoaXMgd2lsbCBub3QgcmUtcmVuZGVyIHRoZSBwYXJlbnQgeW91IHdpbGwgaGF2ZSB0byBjYWxsIHRoaXMucmVuZGVyKCkgdG8gZG8gdGhhdFxuXHRcdCogQHBhcmFtIG1peGVkIEpTT04gZGF0YSB0aGF0IGRlZmluZXMgdGhlIG9iamVjdFxuXHRcdCogQHBhcmFtIHN0cmluZyB3aGVyZSBPcHRpb25hbCB3aGVyZSBjb25kaXRpb24uIEVudW0gb2Y6ICdsYXN0JyAoZGVmYXVsdCksICdhZnRlcidcblx0XHQqIEBwYXJhbSBzdHJpbmcgaWQgSWYgd2hlcmU9PSdhZnRlcicgdGhpcyBpcyB0aGUgZXhpc3RpbmcgY2hpbGQgdG8gaW5zZXJ0IGFmdGVyLiBJZiB0aGUgY2hpbGQgSUQgaXMgbm90IGZvdW5kIHRoZSBuZXcgaXRlbSBpcyBhcHBlbmRlZFxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRhZGRDaGlsZDogZnVuY3Rpb24ob2JqLCB3aGVyZSwgaWQpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHR2YXIgY2hpbGQgPSBudWxsO1xuXG5cdFx0XHRpZiAoIW9iai51c2VzKSAvLyBJbmhlcml0ICd1c2VzJyBmcm9tIHBhcmVudCBpZiBub3Qgc3BlY2lmaWVkXG5cdFx0XHRcdG9iai51c2VzID0gbWUudXNlcztcblxuXHRcdFx0aWYgKG9iai5pbXBvcnQpIHsgLy8gTm8gdHlwZSBleHBsaWNpdCBidXQgaXQgbG9va3MgbGlrZSB3ZSBhcmUgaW5oZXJpdGluZ1xuXHRcdFx0XHR2YXIgbWF0Y2hlcyA9IC9eKC4qKVxcLiguKikkLy5leGVjKG9iai5pbXBvcnQpO1xuXHRcdFx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0XHRcdHZhciBpbXBvcnRGZWVkID0gbWF0Y2hlc1sxXTtcblx0XHRcdFx0XHR2YXIgaW1wb3J0SWQgPSBtYXRjaGVzWzJdO1xuXHRcdFx0XHRcdGlmICghYmF0dC5mZWVkc1tpbXBvcnRGZWVkXSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCdOb24tZXhpc3RhbnQgZmVlZCB0byBpbXBvcnQgZnJvbS4gRmVlZD0nICsgaW1wb3J0RmVlZCArICcsIElEPScgKyBpbXBvcnRJZCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBlbHNlIGlmICghYmF0dC5mZWVkc1tpbXBvcnRGZWVkXS5jaGlsZHJlbltpbXBvcnRJZF0pIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignTm9uLWV4aXN0YW50IGZlZWQgSUQgdG8gaW1wb3J0IGZyb20uIEZlZWQ9JyArIGltcG9ydEZlZWQgKyAnLCBJRD0nICsgaW1wb3J0SWQgKyAnIChmZWVkIGV4aXN0cyBidXQgY2hpbGQgZG9lcyBub3QpJyk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBlbHNlIHsgLy8gQWxsIGlzIHdlbGxcblx0XHRcdFx0XHRcdGNoaWxkID0gYmF0dC5mZWVkc1tpbXBvcnRGZWVkXS5jaGlsZHJlbltpbXBvcnRJZF07XG5cdFx0XHRcdFx0XHRjaGlsZC5kYXRhQmluZGluZyA9IGltcG9ydElkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHsgLy8gRklYTUU6IFdvdWxkIGJlIG5pY2UgaWYgdGhlcmUgd2VyZSBzb21lIG90aGVyIHdheSBvZiBpbXBvcnRpbmdcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ0ltcG9ydCByZWZlcmVuY2UgXCInICsgb2JqLmltcG9ydCArICdcIiBpcyBpbnZhbGlkLiBGb3JtYXQgbXVzdCBiZSBcImZlZWQuaWRcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCFvYmoudHlwZSAmJiBvYmoudXNlcyAmJiBvYmouaWQgJiYgYmF0dC5mZWVkc1tvYmoudXNlc10uY2hpbGRyZW5bb2JqLmlkXSkgeyAvLyBObyB0eXBlIGV4cGxpY2l0IGJ1dCBpdCBsb29rcyBsaWtlIHdlIGFyZSBpbmhlcml0aW5nXG5cdFx0XHRcdGNvbnNvbGUud2FybignSW5oZXJpdGFuY2UgZnJvbSAudXNlcyBpcyBkZXBjcmVjaWF0ZWQhJyk7XG5cdFx0XHRcdGNoaWxkID0gYmF0dC5mZWVkc1tvYmoudXNlc10uY2hpbGRyZW5bb2JqLmlkXTtcblx0XHRcdH0gZWxzZSB7IC8vIFR5cGUgZXhwbGljaXQgT1Igbm8gdXNlc1xuXHRcdFx0XHRjaGlsZCA9IGJhdHQubWFrZU9iamVjdChvYmoudHlwZSA/IG9iai50eXBlIDogbWUuaW1wbHlDaGlsZCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghb2JqLmlkKSB7IC8vIFNldCB1cCBhbiBJRCAtIGV2ZW4gaWYgb25lIGRvZXNudCBhbHJlYWR5IGV4aXN0XG5cdFx0XHRcdG9iai5pZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2ZpZWxkLScpO1xuXHRcdFx0XHRvYmouaWRGYWtlID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSBpZiAoIW9iai5pZEZha2UgJiYgIW9iai50aXRsZSkgLy8gU2V0IHVwIG5pY2UgbG9va2luZyB0aXRsZSBpZiBkb25lIGRvZXNudCBleGlzdFxuXHRcdFx0XHRvYmoudGl0bGUgPSBvYmouaWQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBvYmouaWQuc3Vic3RyKDEpO1xuXG5cdFx0XHRpZiAob2JqLnVzZXMgJiYgYmF0dC5mZWVkc1tvYmoudXNlc10gJiYgYmF0dC5mZWVkc1tvYmoudXNlc10uY2hpbGRyZW5bb2JqLmlkXSkgeyAvLyBVc2VzIGlzIHNvbWV0aGluZyBBTkQgdGhlcmUgaXMgYSB0YWJsZS9jb2wgcGFpciBtYXRjaGluZyB0aGlzIGRlZmluaXRpb24gLSBpbmhlaXJ0IGZyb20gYmFzZSBjbGFzcyArIHRhYmxlICsgb3B0aW9uc1xuXHRcdFx0XHRjaGlsZCA9IGJhdHQuZmVlZHNbb2JqLnVzZXNdLmNoaWxkcmVuW29iai5pZF07XG5cdFx0XHRcdGNoaWxkLmRhdGFCaW5kaW5nID0gb2JqLnVzZXMgKyAnLicgKyBvYmouaWQ7XG5cdFx0XHRcdCQuZXh0ZW5kKGNoaWxkLCBvYmopO1xuXHRcdFx0fSBlbHNlIC8vIE5vIHVzZXMgZGlyZWN0aXZlIC0ganVzdCBpbmhlcml0IGZyb20gYmFzZSBjbGFzcyArIG9wdGlvbnNcblx0XHRcdFx0JC5leHRlbmQoY2hpbGQsIG9iaik7XG5cblx0XHRcdHN3aXRjaCAod2hlcmUpIHtcblx0XHRcdFx0Y2FzZSAnYWZ0ZXInOlxuXHRcdFx0XHRcdHZhciBleGlzdGluZyA9IG1lLmNoaWxkcmVuT3JkZXIuaW5kZXhPZihpZCk7XG5cdFx0XHRcdFx0aWYgKCFpZCkgeyBcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignYmF0dF9jb250YWluZXIuYWRkQ2hpbGQob2JqZWN0LCBcImFmdGVyXCIsIFwiJyArIGlkICsgJ1wiKT4gQXNrZWQgdG8gaW5zZXJ0IGFmdGVyIG5vbi1leGlzdGFudCBpZCBcIicgKyBpZCArICdcIi4gSW5zZXJ0aW5nIGF0IGVuZCBpbnN0ZWFkJyk7XG5cdFx0XHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyLnB1c2goY2hpbGQuaWQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyLnNwbGljZShleGlzdGluZyArIDEsIDAsIGNoaWxkLmlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ2xhc3QnOlxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIucHVzaChjaGlsZC5pZCk7XG5cdFx0XHR9XG5cdFx0XHRtZS5jaGlsZHJlbltjaGlsZC5pZF0gPSBjaGlsZDtcblx0XHRcdGNoaWxkLnNldHVwKCk7XG5cblx0XHRcdGlmIChjaGlsZC5jaGlsZHJlbikgLy8gSW5pdGFsaXplIGFsbCBjaGlsZHJlblxuXHRcdFx0XHRjaGlsZC5zZXQoY2hpbGQuY2hpbGRyZW4sIHRydWUpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUmVtb3ZlIGEgY2hpbGQgb2JqZWN0IGJ5IGl0cyBJRFxuXHRcdCogQHBhcmFtIHN0cmluZyBpZCBUaGUgSUQgb2YgdGhlIGNoaWxkIHRvIHJlbW92ZVxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRyZW1vdmVDaGlsZDogZnVuY3Rpb24oaWQpIHtcblx0XHRcdHZhciBleGlzdGluZyA9IHRoaXMuY2hpbGRyZW5PcmRlci5pbmRleE9mKGlkKTtcblx0XHRcdGlmICghaWQpIHsgXG5cdFx0XHRcdGNvbnNvbGUud2FybignYmF0dF9jb250YWluZXIucmVtb3ZlQ2hpbGQoXCInICsgaWQgKyAnXCIpPiBBc2tlZCB0byByZW1vdmUgbm9uLWV4aXN0YW50IGlkIFwiJyArIGlkICsgJ1wiJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNoaWxkcmVuT3JkZXIuc3BsaWNlKGV4aXN0aW5nLCAxKTtcblx0XHRcdFx0ZGVsZXRlIHRoaXMuY2hpbGRyZW5baWRdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogVGFrZSBhIGNvbXBsZXggSlNPTiBhcnJheSBhbmQgY2FsbCBhZGQoKSBvbiBlYWNoIGl0ZW1cblx0XHQqIFRoaXMgZnVuY3Rpb24gYWxzbyBjbGVhcnMgdGhlIGV4aXN0aW5nIGNoaWxkcmVuXG5cdFx0KiBAcGFyYW0gc3RyaW5nIGpzb24gVGhlIEpTT04gb2JqZWN0IHRvIHByb2Nlc3Ncblx0XHQqIEBwYXJhbSBib29sIGlzQ2hpbGQgSW50ZXJuYWwgcHJvcGVydHkgdG8gcHJldmVudCByZWN1cnNpdmUgJ3VzZXMnIGxvYWRzXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdHNldDogZnVuY3Rpb24oanNvbiwgaXNDaGlsZCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmNoaWxkcmVuID0ge307XG5cdFx0XHRtZS5jaGlsZHJlbk9yZGVyID0gW107XG5cblx0XHRcdC8vIFByZXZlbnQgcmFjZSBjb25kaXRpb24gLSBwcm9jZXNzaW5nIHRyZWUgYmVmb3JlIGNoaWxkLnVzZXMgbW9kdWxlIGxvYWRzIGFyZSByZWFkeSB7e3tcblx0XHRcdGlmICghaXNDaGlsZCkgeyAvLyBNYXN0ZXIgcGFyZW50IGhhcyBhbHJlYWR5IGJlZW4gaW52b2tlZCAtIHdlIGFyZSBwcm9wYmFibHkgaW5zaWRlIGEgcmVjdXJzaXZlIGxvYWRcblx0XHRcdFx0dmFyIG5vbkxvYWRlZFVzZXMgPSBbXTtcblx0XHRcdFx0dmFyIGxvYWRzID0gdGhpcy5kZXRlcm1pbmVVc2VzKGpzb24pO1xuXHRcdFx0XHRmb3IgKHZhciBsIGluIGxvYWRzKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ1JFUVVJUkVTJywgbG9hZHNbbF0sIGJhdHQuZmVlZHNbbG9hZHNbbF1dKTtcblx0XHRcdFx0XHRpZiAoIWJhdHQuZmVlZHNbbG9hZHNbbF1dKVxuXHRcdFx0XHRcdFx0bm9uTG9hZGVkVXNlcy5wdXNoKGJhdHQudXNlc1BhdGggKyBsb2Fkc1tsXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG5vbkxvYWRlZFVzZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0RlZmVyIGxvYWRpbmcgaW50byAnLCBqc29uLCAnIHdhaXQgZm9yIG1vZHVsZXM6Jywgbm9uTG9hZGVkVXNlcyk7XG5cdFx0XHRcdFx0JHNjcmlwdChub25Mb2FkZWRVc2VzLCBmdW5jdGlvbihub3RGb3VuZCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0xPQURFRCBNT0RVTEVTJywgbm9uTG9hZGVkVXNlcywgbm90Rm91bmQpO1xuXHRcdFx0XHRcdFx0aWYgKGJhdHQuc3RvcClcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0bWVcblx0XHRcdFx0XHRcdFx0LnNldChqc29uKVxuXHRcdFx0XHRcdFx0XHQucmVuZGVyKCk7XG5cdFx0XHRcdFx0fSwgZnVuY3Rpb24obm90Rm91bmQpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignQ0FOTk9UIExPQUQgTU9EVUxFUycsIG5vdEZvdW5kKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXG5cdFx0XHQkLmVhY2goanNvbiwgZnVuY3Rpb24oaSwgb2JqKSB7XG5cdFx0XHRcdG1lLmFkZENoaWxkKG9iaik7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFJldHJpZXZlIHRoZSBuZXh0IGRhdGEgcm93IGlmIC5kYXRhU291cmNlIGlzIHNwZWNpZmllZFxuXHRcdCogQHJldHVybiBvYmplY3QgVGhlIGRhdGEgb2JqZWN0IChhbHNvIHNldCBpbiB0aGlzLmRhdGEgZm9yIGNvbnZlbmllbmNlKVxuXHRcdCovXG5cdFx0Z2V0RGF0YTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoIXRoaXMuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyPiBBc2tlZCB0byBnZXREYXRhKCkgYnV0IG5vIGRhdGFTb3VyY2Ugc3BlY2lmaWVkJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldCsrO1xuXHRcdFx0XHRpZiAodGhpcy5kYXRhU291cmNlLmRhdGEgJiYgdGhpcy5kYXRhU291cmNlLmRhdGEucGF5bG9hZCAmJiB0aGlzLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldCA8IHRoaXMuZGF0YVNvdXJjZS5kYXRhLnBheWxvYWQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5kYXRhID0gdGhpcy5kYXRhU291cmNlLmRhdGEucGF5bG9hZFt0aGlzLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldF07XG5cdFx0XHRcdFx0dGhpcy5kYXRhWydfdGFibGUnXSA9IHRoaXMuZGF0YVNvdXJjZS50YWJsZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kYXRhO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHJld2luZERhdGE6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5kYXRhU291cmNlLmRhdGFSb3dPZmZzZXQgPSAtMTtcblx0XHRcdHRoaXMuZGF0YSA9IG51bGw7XG5cdFx0XHRyZXR1cm4gdGhpcy5kYXRhO1xuXHRcdH0sXG5cblx0XHRjbGVhckRhdGE6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKHRoaXMuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRkZWxldGUgdGhpcy5kYXRhU291cmNlLmRhdGE7XG5cdFx0XHRcdHRoaXMucmV3aW5kRGF0YSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogVGVsbCB0aGUgY29udGFpbmVyIGRhdGFTb3VyY2UgdG8gbG9hZCBpdHMgZGF0YVxuXHRcdCogQHBhcmFtIGNhbGxiYWNrIHN1Y2Nlc3MgRnVuY3Rpb24gdG8gY2FsbCB3aGVuIGRhdGEgbG9hZCBoYXMgY29tcGxldGVkXG5cdFx0Ki9cblx0XHRsb2FkQ29udGFpbmVyRGF0YTogZnVuY3Rpb24oc3VjY2Vzcykge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghdGhpcy5kYXRhU291cmNlKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gZGF0YVNvdXJjZSBzcGVjaWZpZWQgd2hlbiB0cnlpbmcgdG8gbG9hZCBkYXRhIScsIHRoaXMpO1xuXHRcdFx0fSBlbHNlIGlmICghdGhpcy5kYXRhU291cmNlLmZlZWQpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBkYXRhU291cmNlLmZlZWQgc3BlY2lmaWVkIHdoZW4gdHJ5aW5nIHRvIGxvYWQgZGF0YSEnKTtcblx0XHRcdH0gZWxzZSBpZiAoIWJhdHQuZmVlZHNbdGhpcy5kYXRhU291cmNlLmZlZWRdKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignUmVxdWVzdGVkIGRhdGEgZnJvbSBkYXRhU291cmNlIFwiJyArIHRoaXMuZGF0YVNvdXJjZS5mZWVkICsgJ1wiIHRoYXQgaXMgbm90IGxvYWRlZCEnKTtcblx0XHRcdH0gZWxzZSBpZiAoIXRoaXMuZGF0YVNvdXJjZS5kYXRhKSB7IC8vIERhdGEgbm90IGFscmVhZHkgbG9hZGVkXG5cdFx0XHRcdHZhciBkcyA9ICQuZXh0ZW5kKHt9LCBtZS5kYXRhU291cmNlLCB7XG5cdFx0XHRcdFx0ZmllbGRzOiBPYmplY3Qua2V5cyhiYXR0LmZlZWRzW21lLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW4pXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChkcy5maWx0ZXJzKSB7IC8vIFBhcnNlIGFsbCBmaWx0ZXIgYXJndW1lbnRzXG5cdFx0XHRcdFx0dmFyIG5ld0ZpbHRlcnMgPSB7fTtcblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gZHMuZmlsdGVycykge1xuXHRcdFx0XHRcdFx0bmV3RmlsdGVyc1trZXldID0gbWUucGFyc2UoZHMuZmlsdGVyc1trZXldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZHMuZmlsdGVycyA9IG5ld0ZpbHRlcnM7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiYXR0LmZlZWRzW2RzLmZlZWRdLmdldERhdGEoZHMsIGZ1bmN0aW9uKGpzb24pIHtcblx0XHRcdFx0XHRtZS5kYXRhU291cmNlLmRhdGEgPSBqc29uO1xuXHRcdFx0XHRcdG1lLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldCA9IC0xO1xuXHRcdFx0XHRcdG1lLnJlbmRlcigpO1xuXHRcdFx0XHR9LCBmdW5jdGlvbihlcnJUZXh0LCBlcnJUaHJvd24pIHtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmZpbmQoJy5iYXR0LWxvYWRpbmcnKS5yZW1vdmUoKTtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZCgnPGRpdiBjbGFzcz1cImFsZXJ0XCI+RXJyb3IgbG9hZGluZyBkYXRhOiAnICsgZXJyVGV4dCArICcgLSAnICsgZXJyVGhyb3duICsgJzwvZGl2PicpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7IC8vIFJlbmRlciBjaGlsZHJlbiB3aXRoIGRhdGFcblx0XHRcdFx0c3VjY2VzcygpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIERyYXcgdGhpcyBjb250YWluZXIgb2JqZWN0XG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5lbGVtZW50KSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdiYXR0X2Zvcm0+IFRvbGQgdG8gcmVuZGVyIGJ1dCB3aXRoIG5vIGVsZW1lbnQnLCBtZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFtZS5jaGlsZHJlbk9yZGVyIHx8ICFtZS5jaGlsZHJlbk9yZGVyLmxlbmd0aCkgeyAvLyBJZiBubyBvcmRlciBpcyBzcGVjaWZpZWQganVzdCB1c2UgdGhlIG9yZGVyIG9mIHRoZSBoYXNoICh3aGljaCB3aWxsIGJlIGFscGhhYmV0aWNhbCBpbiBtb3N0IGNhc2VzIC0gYWxzbyBwcm9iYWJseSB3cm9uZylcblx0XHRcdFx0aWYgKCFtZS5jaGlsZHJlbikge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybignYmF0dF9jb250YWluZXI+IFRvbGQgdG8gcmVuZGVyIGJ1dCBJIGhhdmUgbm8gY2hpbGRyZW4hJywgbWUpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyID0gT2JqZWN0LmtleXMobWUuY2hpbGRyZW4pO1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ05vIGNoaWxkcmVuT3JkZXIgc3BlY2lmaWVkLiBJbmhlcml0aW5nIGZyb20gY2hpbGRyZW4gaGFzaCBpbiBoYXNoIG9yZGVyIGluc3RlYWQnLCBtZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtZS5kYXRhU291cmNlKSB7XG5cdFx0XHRcdG1lLmxvYWRDb250YWluZXJEYXRhKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLmVsZW1lbnQuZW1wdHkoKTtcblx0XHRcdFx0XHRtZS5yZXdpbmREYXRhKCk7XG5cdFx0XHRcdFx0dmFyIGRhdGE7XG5cdFx0XHRcdFx0d2hpbGUgKGRhdGEgPSBtZS5nZXREYXRhKCkpIHtcblx0XHRcdFx0XHRcdC8vIENvcHkgbWUgZGF0YSBpbnRvIGFsbCBjaGlsZHJlblxuXHRcdFx0XHRcdFx0bWUuZWFjaENoaWxkKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy5kYXRhQmluZGluZylcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnZhbHVlID0gZGF0YVt0aGlzLmRhdGFCaW5kaW5nXTtcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBpIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltpXV07XG5cdFx0XHRcdFx0XHRcdGNoaWxkLmxvYWREYXRhKCk7XG5cdFx0XHRcdFx0XHRcdGNoaWxkLnJlbmRlcigpO1xuXG5cdFx0XHRcdFx0XHRcdG1lLnJlbmRlclJvdyhtZS5lbGVtZW50LCBjaGlsZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7IC8vIE5vIGRhdGEgdG8gY2FyZSBhYm91dFxuXHRcdFx0XHRtZS5lbGVtZW50LmVtcHR5KCk7XG5cdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbY11dO1xuXHRcdFx0XHRcdGNoaWxkLmxvYWREYXRhKCk7XG5cdFx0XHRcdFx0Y2hpbGQucmVuZGVyKCk7XG5cblx0XHRcdFx0XHRtZS5yZW5kZXJSb3cobWUuZWxlbWVudCwgY2hpbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAobWUuY2xhc3Nlcylcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlclJvdzogZnVuY3Rpb24oZWxlbWVudCwgY2hpbGQpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdyZW5kZXJSb3cgb2Ygbm9uZS1leGlzdGFudCBlbGVtZW50IGZvciBjaGlsZCcsIGNoaWxkKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzd2l0Y2ggKGNoaWxkLmNvbnRhaW5lckRyYXcpIHsgLy8gV2hpY2ggbWV0aG9kIHRvIHVzZSB3aGVuIGRyYXdpbmcgdGhlIGZpZWxkP1xuXHRcdFx0XHRjYXNlICdkZWJ1Zyc6XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmQoJzxkaXY+REVCVUcgQ0hJTEQ8L2Rpdj4nKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAndGFibGUtY2VsbCc6XG5cdFx0XHRcdFx0Y2hpbGQud3JhcHBlciA9ICQoJzx0ZD48L3RkPicpO1xuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIuYXBwZW5kKGNoaWxkLmVsZW1lbnQpO1xuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kKGNoaWxkLndyYXBwZXIpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdyb3cnOlxuXHRcdFx0XHRjYXNlICdlbnRpcmUtcm93JzogLy8gRG9udCB0cnkgdG8gZG8gYW55dGhpbmdcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC5lbGVtZW50KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnc3Bhbic6IC8vIEV4cGFuZCBvdmVyIHRoZSByb3cgYnV0IHdpdGggc3BhY2luZ1xuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIgPSAkKCc8ZGl2PjwvZGl2PicpO1xuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIuZmlyc3QoKS5hcHBlbmQoY2hpbGQuZWxlbWVudCk7IC8vIExvYWQgdGhlIGNoaWxkIGludG8gdGhlIC5jb250cm9scyBkaXZcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC53cmFwcGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnYnV0dG9ucyc6IC8vIERyYXcgYXMgYnV0dG9uIGdyb3VwXG5cdFx0XHRcdFx0Y2hpbGQud3JhcHBlciA9ICQoXG5cdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cImZvcm0tYWN0aW9uc1wiIHN0eWxlPVwicGFkZGluZy1sZWZ0OiAwcHg7IHRleHQtYWxpZ246IGNlbnRlclwiPidcblx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPjwvZGl2Pidcblx0XHRcdFx0XHRcdCsgJzwvZGl2Pidcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIuY2hpbGRyZW4oJ2RpdicpLmFwcGVuZChjaGlsZC5lbGVtZW50KTsgLy8gTG9hZCB0aGUgY2hpbGQgaW50byB0aGUgLmNvbnRyb2xzIGRpdlxuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kKGNoaWxkLndyYXBwZXIpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdoaWRlLWxhYmVsJzogLy8gRHJhdyBpbiB1c3VhbCBwbGFjZSBidXQgd2l0aG91dCBhIGxhYmVsXG5cdFx0XHRcdFx0Y2hpbGQud3JhcHBlciA9ICQoXG5cdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cImNvbnRyb2wtZ3JvdXBcIj4nXG5cdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwiY29udHJvbHNcIj48L2Rpdj4nXG5cdFx0XHRcdFx0XHQrICc8L2Rpdj4nXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmZpbmQoJy5jb250cm9scycpLmFwcGVuZChjaGlsZC5lbGVtZW50KTsgLy8gTG9hZCB0aGUgY2hpbGQgaW50byB0aGUgLmNvbnRyb2xzIGRpdlxuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kKGNoaWxkLndyYXBwZXIpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdub3JtYWwnOlxuXHRcdFx0XHRjYXNlICd3aXRoLWxhYmVsJzogLy8gV3JhcCBjaGlsZCBpbiB0aGUgdXN1YWwgZmx1ZmYgLSBsYWJlbCArIGlucHV0IGFyZWFcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyID0gJChcblx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwiY29udHJvbC1ncm91cFwiPidcblx0XHRcdFx0XHRcdCsgJzxsYWJlbCBjbGFzcz1cImNvbnRyb2wtbGFiZWxcIj4nICsgKGNoaWxkLnRpdGxlIHx8IGNoaWxkLmlkKSArICc8L2xhYmVsPidcblx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJjb250cm9sc1wiPjwvZGl2Pidcblx0XHRcdFx0XHRcdCsgJzwvZGl2Pidcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIuZmluZCgnLmNvbnRyb2xzJykuYXBwZW5kKGNoaWxkLmVsZW1lbnQpOyAvLyBMb2FkIHRoZSBjaGlsZCBpbnRvIHRoZSAuY29udHJvbHMgZGl2XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmQoY2hpbGQud3JhcHBlcik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0dmFsaWRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudmFsaWRhdGVDaGlsZHJlbi5jYWxsKHRoaXMpO1xuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZUNoaWxkcmVuOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBlcnJvcnMgPSB7fTtcblx0XHRcdGZvciAodmFyIGMgaW4gdGhpcy5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdHZhciBpZCA9IHRoaXMuY2hpbGRyZW5PcmRlcltjXTtcblx0XHRcdFx0dmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpZF07XG5cdFx0XHRcdHZhciByZXN1bHQgPSBjaGlsZC52YWxpZGF0ZSgpO1xuXHRcdFx0XHRpZiAodHlwZW9mIHJlc3VsdCA9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGVycm9yc1tpZF0gPSByZXN1bHQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHJlc3VsdCA9PSAnYXJyYXknKSB7XG5cdFx0XHRcdFx0JC5leHRlbmQoZXJyb3JzLCByZXN1bHQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRcdFx0ZXJyb3JzW2lkXSA9ICdTb21ldGhpbmcgd2VudCB3cm9uZyc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBlcnJvcnM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHRhcmdldDogbnVsbCxcblx0XHRyZW5kZXJUYWc6ICc8ZGl2PjwvZGl2PicsXG5cdFx0c3BsaXRPbjogJywnLFxuXHRcdHNwbGl0SW50bzogJ3ZhbHVlJyxcblx0XHRzcGxpdEJldHdlZW46ICcnLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRpZiAoIW1lLmNoaWxkcmVuT3JkZXIubGVuZ3RoKSB7IC8vIElmIG5vIG9yZGVyIGlzIHNwZWNpZmllZCBqdXN0IHVzZSB0aGUgb3JkZXIgb2YgdGhlIGhhc2ggKHdoaWNoIHdpbGwgYmUgYWxwaGFiZXRpY2FsIGluIG1vc3QgY2FzZXMgLSBhbHNvIHByb2JhYmx5IHdyb25nKVxuXHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyID0gT2JqZWN0LmtleXMobWUuY2hpbGRyZW4pO1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ05vIGNoaWxkcmVuT3JkZXIgc3BlY2lmaWVkLiBJbmhlcml0aW5nIGZyb20gY2hpbGRyZW4gaGFzaCBpbiBoYXNoIG9yZGVyIGluc3RlYWQnLCBtZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghbWUudGFyZ2V0KSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignYmF0dF9jb250YWluZXJfc3BsaXR0ZXI+IE5vIHRhcmdldCBzcGVjaWZpZWQgdG8gd29yayB3aXRoJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghbWUuc3BsaXRPbikge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyX3NwbGl0dGVyPiBObyBzcGxpdE9uIHNwZWNpZmllZCB0byB3b3JrIHdpdGgnKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgdFZhbCA9IG1lLnBhcnNlKG1lLnRhcmdldCk7XG5cblx0XHRcdHZhciBzcGxpdHMgPSB0VmFsLnNwbGl0KG1lLnNwbGl0T24pO1xuXHRcdFx0Zm9yICh2YXIgcyBpbiBzcGxpdHMpIHtcblx0XHRcdFx0bWUuZWFjaENoaWxkKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLmRhdGFbbWUuc3BsaXRJbnRvXSA9IHNwbGl0c1tzXTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbY11dO1xuXHRcdFx0XHRcdGNoaWxkLnJlbmRlcigpO1xuXHRcdFx0XHRcdG1lLnJlbmRlclJvdyhtZS5lbGVtZW50LCBjaGlsZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG1lLnNwbGl0QmV0d2VlbiAmJiBzIDwgc3BsaXRzLmxlbmd0aC0xKVxuXHRcdFx0XHRcdG1lLmVsZW1lbnQuYXBwZW5kKG1lLnNwbGl0QmV0d2Vlbik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0cmVuZGVyVGFnOiAnPGRpdiBjbGFzcz1cImZvcm0taW5saW5lXCI+PC9kaXY+Jyxcblx0XHRzaG93RGF0ZTogdHJ1ZSxcblx0XHRzaG93VGltZTogdHJ1ZSxcblx0XHRyZWFkT25seTogZmFsc2UsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKHRoaXMuc2hvd0RhdGUpXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmQoJzxkaXYgY2xhc3M9XCJpbnB1dC1wcmVwZW5kXCI+PHNwYW4gY2xhc3M9XCJhZGQtb25cIj48aSBjbGFzcz1cImljb24tY2FsZW5kYXJcIj48L2k+PC9zcGFuPjxpbnB1dCB0eXBlPVwiZGF0ZVwiIGNsYXNzPVwiaW5wdXQtbWVkaXVtXCIvPjwvZGl2PicpO1xuXG5cdFx0XHRpZiAodGhpcy5zaG93RGF0ZSAmJiB0aGlzLnNob3dUaW1lKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCcmbmJzcDsnKTtcblxuXHRcdFx0aWYgKHRoaXMuc2hvd1RpbWUpXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmQoJzxkaXYgY2xhc3M9XCJpbnB1dC1wcmVwZW5kXCI+PHNwYW4gY2xhc3M9XCJhZGQtb25cIj48aSBjbGFzcz1cImljb24tdGltZVwiPjwvaT48L3NwYW4+PGlucHV0IHR5cGU9XCJ0aW1lXCIgY2xhc3M9XCJpbnB1dC1zbWFsbFwiLz4nKTtcblxuXHRcdFx0aWYgKHRoaXMucmVhZE9ubHkpXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5maW5kKCdpbnB1dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ3JlYWRvbmx5JywgJ3JlYWRvbmx5Jylcblx0XHRcdFx0XHQuYWRkQ2xhc3MoJ2Rpc2FibGVkSW5wdXQnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblx0XHRpbXBseUNoaWxkOiAnbGluaycsXG5cdFx0dGV4dDogJzxpIGNsYXNzPVwiaWNvbi1hbGlnbi1qdXN0aWZ5XCI+PC9pPicsXG5cdFx0Y29sdW1uVGl0bGU6ICcmbmJzcDsnLFxuXHRcdGNvbHVtbldpZHRoOiAnNTBweCcsXG5cdFx0cmVuZGVyVGFnOiAnPGRpdiBjbGFzcz1cImRyb3Bkb3duXCI+PC9kaXY+JyxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5jaGlsZHJlbk9yZGVyLmxlbmd0aCkgeyAvLyBJZiBubyBvcmRlciBpcyBzcGVjaWZpZWQganVzdCB1c2UgdGhlIG9yZGVyIG9mIHRoZSBoYXNoICh3aGljaCB3aWxsIGJlIGFscGhhYmV0aWNhbCBpbiBtb3N0IGNhc2VzIC0gYWxzbyBwcm9iYWJseSB3cm9uZylcblx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IE9iamVjdC5rZXlzKG1lLmNoaWxkcmVuKTtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBjaGlsZHJlbk9yZGVyIHNwZWNpZmllZC4gSW5oZXJpdGluZyBmcm9tIGNoaWxkcmVuIGhhc2ggaW4gaGFzaCBvcmRlciBpbnN0ZWFkJywgbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgZGRCdXR0b24gPSAkKCc8YSBjbGFzcz1cImJ0blwiIGRhdGEtdG9nZ2xlPVwiZHJvcGRvd25cIj4nICsgKG1lLnRleHQgfHwgbWUudGl0bGUpICsgJzwvYT4nKVxuXHRcdFx0XHQuYXBwZW5kVG8obWUuZWxlbWVudCk7XG5cblx0XHRcdHZhciBkZEl0ZW1zID0gJCgnPHVsIGNsYXNzPVwiZHJvcGRvd24tbWVudVwiPjwvdWw+Jylcblx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXG5cdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdGlmIChjaGlsZC50aXRsZSA9PSAnLScgfHwgY2hpbGQudGV4dCA9PSAnLScpIHsgLy8gQ2hpbGQgaXMgYWN0dWFsbHkgYSBzZXBlcmF0b3Jcblx0XHRcdFx0XHRkZEl0ZW1zLmFwcGVuZCgkKCc8bGkgY2xhc3M9XCJkaXZpZGVyXCI+PC9saT4nKSk7XG5cdFx0XHRcdH0gZWxzZSB7IC8vIENoaWxkIGlzIGEgcmVhbCBib3khXG5cdFx0XHRcdFx0dmFyIGNoaWxkV3JhcHBlciA9ICQoJzxsaT48L2xpPicpO1xuXHRcdFx0XHRcdGNoaWxkLnJlbmRlcigpO1xuXHRcdFx0XHRcdGNoaWxkV3JhcHBlci5hcHBlbmQoY2hpbGQuZWxlbWVudCk7XG5cdFx0XHRcdFx0ZGRJdGVtcy5hcHBlbmQoY2hpbGRXcmFwcGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHVybDogbnVsbCxcblx0XHRrZXk6IG51bGwsXG5cdFx0b3JkZXI6IG51bGwsXG5cblx0XHRzZXQ6IGZ1bmN0aW9uKGpzb24pIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRjb25zb2xlLmxvZygnTG9hZGVkIGZlZWQgXCInICsgbWUuaWQgKyAnXCInKTtcblx0XHRcdGJhdHQuZmVlZHNbbWUuaWRdID0gJC5leHRlbmQoe30sIG1lLCB7Y2hpbGRyZW46IHt9fSk7IC8vIENsb25lIHRvIGdsb2JhbCBvYmplY3QgKGFuZCBudWtlIGFsbCBjaGlsZHJlbiBzaW5jZSB3ZSB3aWxsIGJlIHByb2Nlc3NpbmcgdGhlbSBuZXh0IGFueXdheSlcblx0XHRcdCQuZWFjaChqc29uLCBmdW5jdGlvbihpLCBvYmopIHtcblx0XHRcdFx0YmF0dC5mZWVkc1ttZS5pZF0uYWRkQ2hpbGQob2JqKTtcblx0XHRcdH0pO1xuXHRcdFx0YmF0dC5maW5kKG1lLmlkKS5wYXJlbnQoKS5yZW1vdmVDaGlsZChtZS5pZCk7IC8vIFJlbW92ZSBzZWxmIGZyb20gb2JqZWN0IGxpc3RzXG5cdFx0fSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHsgLy8gRG8gbm90aGluZyAtIHRoaXMgZWxlbWVudCB3aWxsIGJlIHJlbW92ZWQgZHVyaW5nIHNldCgpIGFueXdheVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7IC8vIEFzIHdpdGggc2V0dXAoKSB3ZSBkb250IGRyYXcgdGhpcyB3aWRnZXQgYW55d2F5XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Z2V0RGF0YTogZnVuY3Rpb24oZGF0YVNvdXJjZSwgc3VjY2VzcywgZmFpbCkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdiYXR0X2RiX2ZlZWQ+IEFza2VkIHRvIGdldCBkYXRhIGJ1dCBubyBzcGVjaWZpYyBkcml2ZXIgaXMgc2V0dXAnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRzZXREYXRhOiBmdW5jdGlvbihmaWx0ZXIsIGRhdGEsIHN1Y2Nlc3MsIGZhaWwpIHtcblx0XHRcdGNvbnNvbGUud2FybignYmF0dF9kYl9mZWVkPiBBc2tlZCB0byBzZXQgZGF0YSBidXQgbm8gc3BlY2lmaWMgZHJpdmVyIGlzIHNldHVwJyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsInZhciBzaW1wbGVKc29uRmlsdGVyID0gcmVxdWlyZSgnc2ltcGxlLWpzb24tZmlsdGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dXJsOiAnL2JhdHQvYXBpL2ZlZWQnLFxuXHRcdGtleTogJ2lkJyxcblx0XHRvcmRlcjogJ2lkJyxcblx0XHR0YWJsZTogbnVsbCwgLy8gT3ZlcnJpZGUgaWYgdGhlIHJlbW90ZSB0YWJsZSBkb2VzbnQgbWF0Y2ggdGhpcyBvYmplY3RzIGlkXG5cdFx0ZnVzc3k6IGZhbHNlLCAvLyBBcHBseSBmaWx0ZXJzIHRvIGluY29tbWluZyBKU09OIHN0cmVhbSAoaS5lLiBkb250IHRydXN0IHRoZSBzZXJ2ZXIgdG8gcmV0dXJuIHRoZSByaWdodCBkYXRhKVxuXG5cdFx0LyoqXG5cdFx0KiBJbml0aWFsaXplIGFsbCBjaGlsZCBmaWVsZHNcblx0XHQqIFRoaXMgZnVuY3Rpb24gYWxzbyByZWxvY2F0ZXMgdGhpcyBmaWVsZCBpbnRvIGJhdHQuZmVlZHMgb3V0c2lkZSBvZiB0aGUgdXN1YWwgdHJlZSBzdHJ1Y3R1cmVcblx0XHQqL1xuXHRcdHNldDogZnVuY3Rpb24oanNvbikge1xuXHRcdFx0aWYgKHRoaXMudGFibGUpXG5cdFx0XHRcdHRoaXMudGFibGUgPSB0aGlzLmlkO1xuXHRcdFx0dGhpcy5zdXBlci5zZXQuY2FsbCh0aGlzLCBqc29uKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFJldHJpZXZlIHNvbWUgZGF0YSBiYXNlZCBvbiBhIGdpdmVuIGZpbHRlciArIHRoaXMuZmlsdGVyXG5cdFx0KiBAcGFyYW0gYXJyYXkgZmlsdGVyIEhhc2ggb2YgZmlsdGVycyB0byB1c2UgKGJhc2ljbHkgdGhlIFNRTCBXSEVSRSBjb25kaXRpb24pXG5cdFx0KiBAcGFyYW0gYXJyYXkgZmllbGRzIFRoZSBmaWVsZHMgdG8gcmV0cmlldmVcblx0XHQqIEBwYXJhbSBmdW5jdGlvbiBzdWNjZXNzIFRoZSBzdWNjZXNzIGNhbGxiYWNrIGZ1bmN0aW9uLiBDYWxsZWQgd2l0aCBmdW5jdGlvbihqc29uKVxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uIGZhaWwgVGhlIGZhaWxlZCBjYWxsYmFjayBmdW5jdGlvbi4gQ2FsbGVkIHdpdGggZnVuY3Rpb24oZXJyVGV4dCwgZXJyVGhyb3duKVxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRnZXREYXRhOiBmdW5jdGlvbihkYXRhU291cmNlLCBzdWNjZXNzLCBmYWlsKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0JC5hamF4KHtcblx0XHRcdFx0dXJsOiBtZS51cmwsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdHR5cGU6ICdQT1NUJyxcblx0XHRcdFx0Y2FjaGU6IGZhbHNlLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiAnZ2V0Jyxcblx0XHRcdFx0XHRrZXk6IG1lLmtleSxcblx0XHRcdFx0XHRvcmRlcjogbWUub3JkZXIsXG5cdFx0XHRcdFx0dGFibGU6IG1lLnRhYmxlIHx8IG1lLmlkLFxuXHRcdFx0XHRcdGpvaW5zOiBkYXRhU291cmNlLmpvaW5zLFxuXHRcdFx0XHRcdGZpbHRlcnM6IGRhdGFTb3VyY2UuZmlsdGVycyxcblx0XHRcdFx0XHRmaWVsZHM6IGRhdGFTb3VyY2UuZmllbGRzXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKGpzb24pIHtcblx0XHRcdFx0XHRpZiAobWUuZnVzc3kpIHtcblx0XHRcdFx0XHRcdHZhciBzamYgPSBuZXcgc2ltcGxlSnNvbkZpbHRlcjtcblx0XHRcdFx0XHRcdGpzb24ucGF5bG9hZCA9IHNqZlxuXHRcdFx0XHRcdFx0XHQuZmlsdGVyKGRhdGFTb3VyY2UuZmlsdGVycylcblx0XHRcdFx0XHRcdFx0LmRhdGEoanNvbi5wYXlsb2FkKVxuXHRcdFx0XHRcdFx0XHQubGltaXQoZGF0YVNvdXJjZS5saW1pdClcblx0XHRcdFx0XHRcdFx0LndhbnRBcnJheSgpXG5cdFx0XHRcdFx0XHRcdC5leGVjKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHN1Y2Nlc3MoanNvbik7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVycm9yOiBmdW5jdGlvbihqcXhociwgZXJyVGV4dCwgZXJyVGhyb3duKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKCdFcnJvciB3aGlsZSBwdWxsaW5nIGRhdGEnLCBlcnJUZXh0LCBlcnJUaHJvd24pOyAvLyBGSVhNRTogZGVhbCB3aXRoIHRoaXMgZ3JhY2VmdWxseVxuXHRcdFx0XHRcdGZhaWwoZXJyVGV4dCwgZXJyVGhyb3duKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBTYXZlIGRhdGEgYmFjayB0byB0aGUgQmF0dCBkYXRhIGZlZWRcblx0XHQqIEBwYXJhbSBhcnJheSBmaWx0ZXIgSGFzaCBvZiBmaWx0ZXJzIHRvIHVzZSAoYmFzaWNseSB0aGUgU1FMIFdIRVJFIGNvbmRpdGlvbilcblx0XHQqIEBwYXJhbSBhcnJheSBmaWVsZHMgVGhlIGZpZWxkcyB0byBzZXQgZm9yIHRoZSBnaXZlbiBmaXRsZXJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbiBzdWNjZXNzIFRoZSBzdWNjZXNzIGNhbGxiYWNrIGZ1bmN0aW9uLiBDYWxsZWQgd2l0aCBmdW5jdGlvbihqc29uKVxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uIGZhaWwgVGhlIGZhaWxlZCBjYWxsYmFjayBmdW5jdGlvbi4gQ2FsbGVkIHdpdGggZnVuY3Rpb24oZXJyVGV4dCwgZXJyVGhyb3duKVxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRzZXREYXRhOiBmdW5jdGlvbihkYXRhU291cmNlLCBkYXRhLCBzdWNjZXNzLCBmYWlsKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0JC5hamF4KHtcblx0XHRcdFx0dXJsOiBtZS51cmwsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdHR5cGU6ICdQT1NUJyxcblx0XHRcdFx0Y2FjaGU6IGZhbHNlLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiAnc2V0Jyxcblx0XHRcdFx0XHRrZXk6IG1lLmtleSxcblx0XHRcdFx0XHR0YWJsZTogbWUudGFibGUgfHwgbWUuaWQsXG5cdFx0XHRcdFx0ZmlsdGVyczogZGF0YVNvdXJjZS5maWx0ZXJzLFxuXHRcdFx0XHRcdGZpZWxkczogZGF0YVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHRcdFx0c3VjY2Vzcyhqc29uKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0ZXJyb3I6IGZ1bmN0aW9uKGpxeGhyLCBlcnJUZXh0LCBlcnJUaHJvd24pIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ0Vycm9yIHdoaWxlIHNldHRpbmcgZGF0YScsIGVyclRleHQsIGVyclRocm93bik7IC8vIEZJWE1FOiBkZWFsIHdpdGggdGhpcyBncmFjZWZ1bGx5XG5cdFx0XHRcdFx0ZmFpbChlcnJUZXh0LCBlcnJUaHJvd24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHR0ZXh0OiAnPGkgY2xhc3M9XCJpY29uLWZpbGVcIj48L2k+IFNlbGVjdCBmaWxlLi4uJyxcblx0XHRjbGFzc2VzOiAnYnRuJyxcblx0XHR0ZXh0VXBsb2FkaW5nOiAnPGkgY2xhc3M9XCJpY29uLWZpbGUgaWNvbi13aGl0ZVwiPjwvaT4ge3t2YWx1ZX19Jyxcblx0XHRjbGFzc2VzVXBsb2FkaW5nOiAnYnRuIGJ0bi1zdWNjZXNzJyxcblx0XHRyZW5kZXJUYWc6ICc8ZGl2PjxkaXYgc3R5bGU9XCJkaXNwbGF5OiBub25lXCI+PGlucHV0IHR5cGU9XCJmaWxlXCIvPjwvZGl2PjxhPjwvYT48L2Rpdj4nLFxuXHRcdGF1dG9EdXBsaWNhdGU6IGZhbHNlLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHR2YXIgYnV0dG9uID0gdGhpcy5lbGVtZW50LmZpbmQoJ2EnKVxuXHRcdFx0XHQub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0ZmlsZS50cmlnZ2VyKCdjbGljaycpO1xuXHRcdFx0XHR9KTtcblx0XHRcdHZhciBmaWxlID0gdGhpcy5lbGVtZW50LmZpbmQoJ2lucHV0W3R5cGU9ZmlsZV0nKVxuXHRcdFx0XHQuYXR0cignbmFtZScsIG1lLmlkKVxuXHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLnJlbmRlcigpO1xuXHRcdFx0XHRcdGlmIChtZS5hdXRvRHVwbGljYXRlKSB7XG5cdFx0XHRcdFx0XHRtZS5wYXJlbnQoKVxuXHRcdFx0XHRcdFx0XHQuYWRkQ2hpbGQoJC5leHRlbmQoe30sIG1lLCB7aWQ6IGJhdHQuZ2V0VW5pcXVlSWQobWUuaWQpLCB2YWx1ZTogbnVsbH0pLCAnYWZ0ZXInLCBtZS5pZClcblx0XHRcdFx0XHRcdFx0LnJlbmRlcigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRpZiAoZmlsZS52YWwoKSkgeyAvLyBIYXMgYSBmaWxlIHRvIHVwbG9hZFxuXHRcdFx0XHRtZS52YWx1ZSA9IGZpbGUudmFsKCkucmVwbGFjZSgvXFxcXC9nLCcvJykucmVwbGFjZSggLy4qXFwvLywnJyk7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5odG1sKG1lLnBhcnNlKG1lLnRleHRVcGxvYWRpbmcpKVxuXHRcdFx0XHRcdC5yZW1vdmVDbGFzcyhtZS5jbGFzc2VzKVxuXHRcdFx0XHRcdC5hZGRDbGFzcyhtZS5jbGFzc2VzVXBsb2FkaW5nKTtcblx0XHRcdH0gZWxzZSB7IC8vIE5vdGhpbmcgdG8gdXBsb2FkIGJ1dCBzdGlsbCBoYXMgc3lsaW5nXG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5odG1sKG1lLnBhcnNlKG1lLnRleHQpKVxuXHRcdFx0XHRcdC5yZW1vdmVDbGFzcyhtZS5jbGFzc2VzVXBsb2FkaW5nKVxuXHRcdFx0XHRcdC5hZGRDbGFzcyhtZS5jbGFzc2VzKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRtZXRob2Q6ICdQT1NUJywgLy8gUE9TVCAtIFJlZ3VsYXIgSFRNTCBzdWJtaXQsIEJBVFQgLSBpbnRlcm5hbCBBSkFYIGNhbGxzIHRvIGEgQmF0dCBzZXJ2ZXJcblx0XHRhY3Rpb246ICc/JywgLy8gSWYgdHlwZT1odG1sIHRoaXMgaXMgdGhlIGxvY2F0aW9uIHdoZXJlIHRoZSBmb3JtIHdpbGwgYmUgc3VibWl0dGVkLlxuXHRcdHJlbmRlclRhZzogJzxmb3JtIGFjdGlvbj1cInt7dGhpcy5hY3Rpb259fVwiIG1ldGhvZD1cIlBPU1RcIiBjbGFzcz1cImZvcm0taG9yaXpvbnRhbFwiIGVuY3R5cGU9XCJtdWx0aXBhcnQvZm9ybS1kYXRhXCI+PC9mb3JtPicsXG5cblx0XHRzdWJtaXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmIChtZS52YWxpZGF0ZSgpKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdTVUJNSVQ+IE9LJyk7XG5cblx0XHRcdFx0Ly8gR2V0IGFsbCBjaGlsZHJlbiB3aGljaCByZXF1ZXN0IGZyb20gYSBkYXRhU291cmNlIHt7e1xuXHRcdFx0XHR2YXIgZGF0YVNvdXJjZXMgPSBbXTtcblx0XHRcdFx0bWUuZWFjaENoaWxkKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmICh0aGlzLmRhdGFTb3VyY2UpXG5cdFx0XHRcdFx0XHRkYXRhU291cmNlcy5wdXNoKHRoaXMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Ly8gfX19XG5cdFx0XHRcdC8vIEZJWE1FOiBBdm9pZCBwZWVycyBiZWluZyBpbnNpZGUgcGVlcnNcblx0XHRcdFx0Ly8gRm9yIGVhY2ggZGF0YVNvdXJjZS4uLiB7e3tcblx0XHRcdFx0Zm9yICh2YXIgaSBpbiBkYXRhU291cmNlcykge1xuXHRcdFx0XHRcdHZhciBkYXRhID0ge307XG5cdFx0XHRcdFx0dmFyIGRzID0gJC5leHRlbmQoe30sIGRhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UpO1xuXHRcdFx0XHRcdC8vIEV2YWx1YXRlIGFsbCBmaWx0ZXJzIHt7e1xuXHRcdFx0XHRcdGlmIChkcy5maWx0ZXJzKSB7IC8vIFBhcnNlIGFsbCBmaWx0ZXIgYXJndW1lbnRzXG5cdFx0XHRcdFx0XHR2YXIgbmV3RmlsdGVycyA9IHt9O1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIGRzLmZpbHRlcnMpIHtcblx0XHRcdFx0XHRcdFx0bmV3RmlsdGVyc1trZXldID0gbWUucGFyc2UoZHMuZmlsdGVyc1trZXldKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGRzLmZpbHRlcnMgPSBuZXdGaWx0ZXJzO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyB9fX1cblx0XHRcdFx0XHRkYXRhU291cmNlc1tpXS5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRcdCh0aGlzLmRhdGFCaW5kaW5nKSAvLyBIYXMgYSBkYXRhIGJpbmRpbmdcblx0XHRcdFx0XHRcdFx0JiYgKGJhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXSkgLy8gVGhlIGZlZWQgdGhpcyBpdGVtIGlzIHBvaW50aW5nIGF0IGlzIHZhbGlkXG5cdFx0XHRcdFx0XHRcdCYmIChiYXR0LmZlZWRzW2RhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW5bdGhpcy5kYXRhQmluZGluZ10pIC8vIFRoZSBmZWVkIHJlY29nbml6ZXMgdGhpcyBjaGlsZFxuXHRcdFx0XHRcdFx0XHQmJiAoYmF0dC5mZWVkc1tkYXRhU291cmNlc1tpXS5kYXRhU291cmNlLmZlZWRdLmNoaWxkcmVuW3RoaXMuZGF0YUJpbmRpbmddLmFsbG93U2V0KSAvLyBUaGUgZmVlZCBzYXlzIHRoaXMgY2hpbGQgaXRlbSBjYW4gYmUgc2V0XG5cdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0aWYgKGJhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXS5jaGlsZHJlblt0aGlzLmRhdGFCaW5kaW5nXS5kYXRhSWQpIHsgLy8gVXNlIGFsdGVybmF0ZSBpbnRlcm5hbCBuYW1lIGZvciB0aGUgZGF0YUlkXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YVtiYXR0LmZlZWRzW2RhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW5bdGhpcy5kYXRhQmluZGluZ10uZGF0YUlkXSA9IHRoaXMudmFsdWU7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7IC8vIE5vIGFsdGVybmF0ZSBzcGVjaWZpZWQgLSBqdXN0IHBhc3MgdGhlIElEXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YVt0aGlzLmRhdGFCaW5kaW5nXSA9IHRoaXMudmFsdWU7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRiYXR0LmZlZWRzW2RhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UuZmVlZF0uc2V0RGF0YShkcywgZGF0YSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnRklYTUU6IFNBVkVEIScpO1xuXHRcdFx0XHRcdH0sIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0ZJWE1FOiBTQVZFIEZBSUxFRCEnKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyB9fX1cblxuXG5cdFx0XHRcdC8qXG5cdFx0XHRcdHN3aXRjaCAobWUubWV0aG9kLnRvVXBwZXJDYXNlKCkpIHtcblx0XHRcdFx0XHRjYXNlICdQT1NUJzpcblx0XHRcdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCF0aGlzLmlkRmFrZSlcblx0XHRcdFx0XHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZCgnPGlucHV0IHR5cGU9XCJoaWRkZW5cIiBuYW1lPVwiJyArIHRoaXMuaWQgKyAnXCIgdmFsdWU9XCInICsgKHRoaXMudmFsdWUgIT09IG51bGwgPyB0aGlzLnZhbHVlIDogJycpICsgJ1wiLz4nKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0bWUuZWxlbWVudC50cmlnZ2VyKCdzdWJtaXQnKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ0JBVFQnOlxuXHRcdFx0XHRcdFx0dmFyIGRhdGEgPSB7fTtcblx0XHRcdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuZGF0YUJpbmRpbmcpXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YVt0aGlzLmRhdGFCaW5kaW5nXSA9IHRoaXMudmFsdWU7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignQmF0dCBzdWJtaXNzaW9uIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnU0FWRT4nLCBkYXRhKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRhbGVydCgnVW5zdXBwb3J0ZWQgZm9ybSB0eXBlOiAnICsgbWUubWV0aG9kKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQqL1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1NVQk1JVD4gRkFJTCcpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0dmFyIGZvcm0gPSAkKG1lLnBhcnNlKG1lLnJlbmRlclRhZykpO1xuXHRcdFx0aWYgKG1lLmVsZW1lbnQpIHsgLy8gSGFzIHBhcmVudCBlbGVtZW50IC0gcHJvYmFibHkgYWxsb2NhdGVkIGJ5IG1haW4gYmF0dC5qcyBwcm9jZXNzIGR1cmluZyBjcmVhdGlvblxuXHRcdFx0XHR2YXIgb3V0ZXJGb3JtID0gJChtZS5wYXJzZShtZS5yZW5kZXJUYWcpKVxuXHRcdFx0XHRcdC5hcHBlbmRUbyhtZS5lbGVtZW50KTtcblx0XHRcdFx0bWUuZWxlbWVudCA9IG91dGVyRm9ybTtcblx0XHRcdH0gZWxzZSB7IC8vIE5vIGV4aXN0aW5nIGVsZW1lbnQgLSBwcm9iYWJseSBhIG5lc3RlZCBvYmplY3Rcblx0XHRcdFx0bWUuZWxlbWVudCA9IGZvcm07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRpZiAoIW1lLmVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ2JhdHRfZm9ybT4gVG9sZCB0byByZW5kZXIgYnV0IHdpdGggbm8gcGFyZW50IGVsZW1lbnQnLCBtZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bWUuc3VwZXIucmVuZGVyLmNhbGwobWUpO1xuXHRcdFx0bWUuZWFjaENoaWxkKGZ1bmN0aW9uKCkgeyAvLyBDYWxjdWxhdGUgaW5pdGlhbCBzdGF0ZSBvZiBhbGwgc2hvd0lmIGV2ZW50c1xuXHRcdFx0XHR0aGlzLmNoYW5nZU90aGVyKGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdzcGFuJyxcblx0XHR0aXRsZTogJ0EgaGVhZGluZycsXG5cdFx0cmVuZGVyVGFnOiAnPGxlZ2VuZD48L2xlZ2VuZD4nLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5odG1sKHRoaXMudGl0bGUpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdzcGFuJyxcblx0XHR0ZXh0OiAnPGRpdiBjbGFzcz1cImFsZXJ0IGFsZXJ0LWluZm9cIj5IZWxsbyBXb3JsZDwvZGl2PicsXG5cdFx0Y2xhc3NlczogbnVsbCxcblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGh0bWwgPSB0aGlzLnRleHQgfHwgdGhpcy50aXRsZTtcblx0XHRcdGlmIChodG1sLnN1YnN0cigwLCAxKSAhPSAnPCcpIC8vIERvZXNuJ3QgYWxyZWFkeSBoYXZlIGEgdGFnIHN0cnVjdHVyZVxuXHRcdFx0XHRodG1sID0gJzxkaXY+JyArIGh0bWwgKyAnPC9kaXY+JztcblxuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnBhcnNlKGh0bWwpKTtcblxuXHRcdFx0aWYgKHRoaXMuY2xhc3Nlcylcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFkZENsYXNzKHRoaXMuY2xhc3Nlcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0cGxhY2Vob2xkZXI6IG51bGwsXG5cdFx0cmVxdWlyZWQ6IGZhbHNlLFxuXHRcdGxlbmd0aE1heDogbnVsbCxcblx0XHRsZW5ndGhNaW46IG51bGwsXG5cdFx0cmVhZE9ubHk6IG51bGwsXG5cdFx0ZXJyb3JSZXF1aXJlZDogJ1N0cmluZyByZXF1aXJlZCcsXG5cdFx0ZXJyb3JMZW5ndGhNYXg6ICdTdHJpbmcgdG9vIGxvbmcnLFxuXHRcdGVycm9yTGVuZ3RoTWluOiAnU3RyaW5nIHRvbyBzaG9ydCcsXG5cblx0XHRjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZWxlbWVudC52YWwoKTtcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHR0aGlzXG5cdFx0XHRcdC5lbGVtZW50ID0gJCgnPGlucHV0Lz4nKVxuXHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLmNoYW5nZS5jYWxsKG1lKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRpZiAodGhpcy52YWx1ZSlcblx0XHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ3ZhbHVlJywgdGhpcy52YWx1ZSk7XG5cdFx0XHRpZiAodGhpcy5wbGFjZWhvbGRlcilcblx0XHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ3BsYWNlaG9sZGVyJywgdGhpcy5wbGFjZWhvbGRlcik7XG5cdFx0XHRpZiAodGhpcy5yZWFkT25seSlcblx0XHRcdFx0dGhpcy5lbGVtZW50XG5cdFx0XHRcdFx0LmF0dHIoJ3JlYWRvbmx5JywgJ3JlYWRvbmx5Jylcblx0XHRcdFx0XHQuYWRkQ2xhc3MoJ2Rpc2FibGVkSW5wdXQnKTtcblx0XHRcdGlmICh0aGlzLmRhdGFCaW5kaW5nKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXR0cignYmF0dC1kYXRhLWJpbmRpbmcnLCB0aGlzLmRhdGFCaW5kaW5nKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAodGhpcy5yZXF1aXJlZCAmJiAhdGhpcy52YWx1ZSlcblx0XHRcdFx0cmV0dXJuIHRoaXMuZXJyb3JSZXF1aXJlZDtcblx0XHRcdGlmICh0aGlzLmxlbmd0aE1heCAmJiB0aGlzLnZhbHVlLmxlbmd0aCA+IHRoaXMubGVuZ3RoTWF4KVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvckxlbmd0aE1heDtcblx0XHRcdGlmICh0aGlzLmxlbmd0aE1pbiAmJiB0aGlzLnZhbHVlLmxlbmd0aCA+IHRoaXMubGVuZ3RoTWluKVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvckxlbmd0aE1pbjtcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogbnVsbCxcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblx0XHRjbGFzc2VzOiBudWxsLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCgnPGxhYmVsIGNsYXNzPVwiY2hlY2tib3hcIj48L2xhYmVsPicpOyAvLyBPZGQgdGhhdCBCb290c3RyYXAgaGFzIG5vIG90aGVyIHdheSBvZiBoYXZpbmcgbm9uLXdlaXJkIGxvb2tpbmcgZm9ybSB0ZXh0XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5lbGVtZW50Lmh0bWwobWUucGFyc2UobWUudGV4dCB8fCBtZS50aXRsZSB8fCAnQSBsYWJlbCcpKTtcblx0XHRcdFxuXHRcdFx0aWYgKG1lLmNsYXNzZXMpXG5cdFx0XHRcdG1lLmVsZW1lbnQuYWRkQ2xhc3MobWUuY2xhc3Nlcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogbnVsbCxcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblx0XHRhY3Rpb246ICdub3RoaW5nJyxcblx0XHRjbGFzc2VzOiBudWxsLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCgnPGE+PC9hPicpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0dmFyIGFjdGlvbiA9IG1lLnBhcnNlKG1lLmFjdGlvbik7XG5cdFx0XHRtZS5lbGVtZW50XG5cdFx0XHRcdC5odG1sKG1lLnBhcnNlKG1lLnRleHQgfHwgbWUudGl0bGUgfHwgJ0EgbGluaycpKVxuXHRcdFx0XHQuYXR0cignaHJlZicsIGFjdGlvbik7XG5cdFx0XHRcblx0XHRcdGlmIChtZS5jbGFzc2VzKVxuXHRcdFx0XHRtZS5lbGVtZW50LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXG5cdFx0XHRzd2l0Y2ggKGFjdGlvbikge1xuXHRcdFx0XHRjYXNlICdub3RoaW5nJzpcblx0XHRcdFx0XHRtZS5lbGVtZW50LmNsaWNrKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0YWxlcnQoJ05vIGFjdGlvbiBpcyBhc3NpZ25lZCB0byB0aGlzIGJ1dHRvbicpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdzYXZlJzpcblx0XHRcdFx0Y2FzZSAnc3VibWl0Jzpcblx0XHRcdFx0XHRtZS5lbGVtZW50LmNsaWNrKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0bWUuZmluZFBhcmVudCgnZm9ybScpLnN1Ym1pdCgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OiAvLyBBc3NpZ24gYXMgaHJlZiBsaW5rXG5cdFx0XHRcdFx0bWUuZWxlbWVudC5hdHRyKCdocmVmJywgYWN0aW9uKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRtaW46IG51bGwsXG5cdFx0bWF4OiBudWxsLFxuXHRcdGRlY2ltYWxzOiAwLFxuXHRcdGVycm9yTWluOiAnTnVtYmVyIHRvbyBzbWFsbCcsXG5cdFx0ZXJyb3JNYXg6ICdOdW1iZXIgdG9vIGxhcmdlJyxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnJlbmRlci5jYWxsKHRoaXMpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ3R5cGUnLCAnbnVtYmVyJyk7XG5cdFx0XHRpZiAodGhpcy5kZWNpbWFscylcblx0XHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ3N0ZXAnLCAnYW55Jyk7XG5cdFx0XHRpZiAodGhpcy5taW4pXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hdHRyKCdtaW4nLCB0aGlzLm1pbik7XG5cdFx0XHRpZiAodGhpcy5tYXgpXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hdHRyKCdtYXgnLCB0aGlzLm1heCk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0dmFsaWRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zdXBlci52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuXHRcdFx0aWYgKHRoaXMubWluICYmIHRoaXMudmFsdWUgPCB0aGlzLm1pbilcblx0XHRcdFx0cmV0dXJuIHRoaXMuZXJyb3JNaW47XG5cdFx0XHRpZiAodGhpcy5tYXggJiYgdGhpcy52YWx1ZSA+IHRoaXMubWF4KVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvck1heDtcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0aWQ6IG51bGwsXG5cdFx0ZGF0YUlkOiBudWxsLCAvLyBJZiB0aGUgaW50ZXJuYWwgc3RvcmFnZSByZWZlcnMgdG8gdGhlIGZpZWxkIGJ5IGFub3RoZXIgbmFtZSAtIHNwZWNpZnkgaXQgaGVyZVxuXHRcdHZhbHVlOiBudWxsLFxuXHRcdGRlZmF1bHQ6IG51bGwsXG5cdFx0ZWxlbWVudDogbnVsbCxcblx0XHRjb250YWluZXJEcmF3OiAnd2l0aC1sYWJlbCcsXG5cdFx0dXNlczogbnVsbCxcblx0XHRzaG93SWY6IG51bGwsXG5cblx0XHQvLyBEdW1teSBmdW5jdGlvbnNcblx0XHR2YWxpZGF0ZTogZnVuY3Rpb24oKSB7IHJldHVybjsgfSxcblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSxcblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9LFxuXHRcdGNsZWFyRGF0YTogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9LFxuXG5cdFx0bG9hZERhdGE6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKHRoaXMudmFsdWUpIC8vIFdlIGFscmVhZHkgaGF2ZSBhIHZhbHVlXG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXG5cdFx0XHRpZiAodGhpcy5kYXRhICYmIHRoaXMuZGF0YVt0aGlzLmlkXSkgeyAvLyBJcyB0aGVyZSBhbnl0aGluZyBpbiB0aGUgZGF0YSBzdHJlYW0/XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmRhdGFbdGhpcy5pZF07XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuZGVmYXVsdCkgeyAvLyBJcyB0aGVyZSBhIGRlZmF1bHQgdmFsdWU/XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmRlZmF1bHQ7XG5cdFx0XHR9IGVsc2UgeyAvLyBGb3VuZCBub3RoaW5nIC0gc2V0IHRvIG51bGxcblx0XHRcdFx0dGhpcy52YWx1ZSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBMb2NhdGUgdGhlIHBhcmVudCBvZiB0aGUgY3VycmVudCBCYXR0IG9iamVjdCBhbmQgcmV0dXJuIGVpdGhlciB0aGUgc3RhY2sgb2YgYWxsIHBhcmVudHMgKGdyYW5kLXBhcmVudHMgZXRjLikgb3IgYSBzcGVjaWZpYyB0eXBlXG5cdFx0KiBCZWNhdXNlIG9mIGhhc2gtb2YtaGFzaGVzIHN0cnVjdHVyZSBCYXR0IHVzZXMgdG8gc3Rhc2ggaXRzIG9iamVjdHMgdGhpcyBmdW5jdGlvbiBkb2VzIGEgdG9wLWRvd24gc2VhcmNoIG9mIGFsbCBmb3JtcyBhbmQgYWxsIGNoaWxkcmVuIHVudGlsIGl0IGhpdHMgdGhlIGN1cnJlbnQgaWQsIGl0IHRoZW4gYnViYmxlcyB1cCBhcyBhIHJldHVybiB2YWx1ZSB0byBmaW5kIHRoZSBzdGFjayBvZiBhbGwgcGFyZW50c1xuXHRcdCogQHBhcmFtIHN0cmluZyB0eXBlIE9wdGlvbmFsIHR5cGUgdG8gbGltaXQgb3Vyc2VsdmVzIHRvLiBJZiBzcGVjaWZpZWQgdGhlIHJldHVybiB3aWxsIGVpdGhlciBiZSB0aGUgZmlyc3Qgd2lkZ2V0IG1hdGNoaW5nIHRoZSB0eXBlIE9SIG51bGxcblx0XHQqIEByZXR1cm4gb2JqZWN0fG51bGx8YXJyYXkgSWYgdHlwZSBpcyBzcGVjaWZpZWQgdGhlIGZpcnN0IG9iamVjdCBtYXRjaGluZyB0aGUgdHlwZSBPUiBudWxsLCBpZiB1bnNwZWNpZmllZCBhbiBhcnJheSBvZiBhbGwgcGFyZW50c1xuXHRcdCovXG5cdFx0ZmluZFBhcmVudDogZnVuY3Rpb24odHlwZSkge1xuXHRcdFx0dmFyIGZpbmRQYXJlbnRXb3JrZXIgPSBmdW5jdGlvbihpZCwgY29udGV4dCwgc3RhY2spIHtcblx0XHRcdFx0aWYgKCFjb250ZXh0LmNoaWxkcmVuKVxuXHRcdFx0XHRcdHJldHVybjtcblxuXHRcdFx0XHRpZiAoY29udGV4dC5jaGlsZHJlbltpZF0pIHtcblx0XHRcdFx0XHRzdGFjay5wdXNoKGNvbnRleHQuY2hpbGRyZW5baWRdKTtcblx0XHRcdFx0XHRzdGFjay5wdXNoKGNvbnRleHQpO1xuXHRcdFx0XHRcdHJldHVybiBzdGFjaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGZvciAodmFyIGMgaW4gY29udGV4dC5jaGlsZHJlbikge1xuXHRcdFx0XHRcdHZhciBmb3VuZCA9IGZpbmRQYXJlbnRXb3JrZXIoaWQsIGNvbnRleHQuY2hpbGRyZW5bY10sIHN0YWNrKTtcblx0XHRcdFx0XHRpZiAoZm91bmQpIHtcblx0XHRcdFx0XHRcdHN0YWNrLnB1c2goY29udGV4dCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc3RhY2s7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fTtcblxuXHRcdFx0Zm9yICh2YXIgYiBpbiBiYXR0LmZvcm1zKSB7XG5cdFx0XHRcdHZhciBzdGFjayA9IGZpbmRQYXJlbnRXb3JrZXIodGhpcy5pZCwgYmF0dC5mb3Jtc1tiXSwgW10pO1xuXHRcdFx0XHRpZiAoc3RhY2spIHtcblx0XHRcdFx0XHRpZiAodHlwZSkgeyAvLyBMb29raW5nIGZvciBhIHNwZWNpZmljIHR5cGVcblx0XHRcdFx0XHRcdGZvciAodmFyIHAgaW4gc3RhY2spXG5cdFx0XHRcdFx0XHRcdGlmIChzdGFja1twXS50eXBlID09IHR5cGUpXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHN0YWNrW3BdO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc3RhY2suc2xpY2UoMSk7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogQ29udmVuaWVuY2Ugd3JhcHBlciBmb3IgY2FsbGluZyBwYXJlbnRzKCkgYW5kIHVzaW5nIG9ubHkgdGhlIGZpcnN0IGl0ZW0gb2YgdGhlIGFycmF5XG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGUgcGFyZW50IChhIGNvbnRhaW5lcikgb2YgdGhlIGN1cnJlbnQgb2JqZWN0XG5cdFx0Ki9cblx0XHRwYXJlbnQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHBhcmVudHMgPSB0aGlzLmZpbmRQYXJlbnQuY2FsbCh0aGlzKTtcblx0XHRcdHJldHVybiBwYXJlbnRzWzBdO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFJ1biBhIGNhbGxiYWNrIG92ZXIgZWFjaCBwYXJlbnQgb2YgdGhlIGN1cnJlbnQgb2JqZWN0XG5cdFx0KiBUaGlzIGZ1bmN0aW9uIGlzIHJlY3Vyc2l2ZS4gSWYgeW91IHJlcXVpcmUganVzdCB0aGUgaW1tZWRpYXRlIHBhcmVudHMgdXNlIG9iamVjdC5wYXJlbnQoKVxuXHRcdCogVGhpcyBpcyB0aGUgbWlycm9yIGZ1bmN0aW9uIG9mIGVhY2hDaGlsZCgpXG5cdFx0KiBAcGFyYW0gY2FsbGJhY2sgY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJ1bi4gQ2FsbGVkIGluIHRoZSBmb3JtYXQgZnVuY3Rpb24oKSB7fSBzZXR0aW5nICd0aGlzJyB0byB0aGUgY3VycmVudCBjb250ZXh0XG5cdFx0KiBAcGFyYW0gaGFzaCBvcHRpb25zIEEgaGFzaCBvZiBvcHRpb25zIHRvIHVzZSB3aGVuIGZpbHRlcmluZ1xuXHRcdCogQHBhcmFtIG9iamVjdCBvYmplY3QgQ29udGV4dCBvYmplY3QgKGludGVybmFsIHVzZSBvbmx5KVxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRlYWNoUGFyZW50OiBmdW5jdGlvbihjYWxsYmFjaywgb3B0aW9ucywgY29udGV4dCkge1xuXHRcdFx0aWYgKCFjb250ZXh0KVxuXHRcdFx0XHRjb250ZXh0ID0gdGhpcztcblxuXHRcdFx0dmFyIHNldHRpbmdzID0gJC5leHRlbmQoe30sIHtcblx0XHRcdFx0YW5kU2VsZjogZmFsc2Vcblx0XHRcdH0sIG9wdGlvbnMpO1xuXG5cdFx0XHRpZiAoc2V0dGluZ3MuYW5kU2VsZilcblx0XHRcdFx0Y2FsbGJhY2suY2FsbChjb250ZXh0KTtcblxuXHRcdFx0dmFyIG5vZGVzID0gdGhpcy5maW5kUGFyZW50KCk7XG5cdFx0XHRmb3IgKHZhciBwaWQgaW4gbm9kZXMpIHtcblx0XHRcdFx0dmFyIG5vZGUgPSBub2Rlc1twaWRdO1xuXHRcdFx0XHRjYWxsYmFjay5jYWxsKG5vZGUpO1xuXHRcdFx0fTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFBhcnNlIGEgTXVzdGFjaGUgdGVtcGxhdGUgYWdhaW5zdCB0aGUgY3VycmVudCBvYmplY3Rcblx0XHQqIFRoaXMgaXMgcmVhbGx5IGp1c3QgYSBoZWxwZXIgZm9yIHRoZSBjb3JlIGJhdHQucGFyc2UoKSBmdW5jdGlvblxuXHRcdCogQHBhcmFtIHN0cmluZyBzdHJpbmcgVGhlIHN0cmluZyB0byBwYXJzZSBhbmQgcmV0dXJuXG5cdFx0KiBAcGFyYW0gb2JqZWN0IGRhdGEgQWRkaXRpb25hbCBkYXRhIHRvIHBhc3MgdG8gdGhlIHBhcnNlIGZ1bmN0aW9uXG5cdFx0KiBAcmV0dXJuIHN0cmluZyBUaGUgcGFyc2VkIHN0cmluZ1xuXHRcdCovXG5cdFx0cGFyc2U6IGZ1bmN0aW9uKHN0cmluZywgZGF0YSkge1xuXHRcdFx0cmV0dXJuIGJhdHQucGFyc2Uoc3RyaW5nLCBkYXRhID8gJC5leHRlbmQoe30sIHRoaXMsIGRhdGEpIDogdGhpcyk7XG5cdFx0fSxcblxuXHRcdGNoYW5nZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0Ly8gVHJpZ2dlciB0aGUgY2hhbmdlT3RoZXIgZXZlbnQgb24gYWxsIG90aGVyIGl0ZW1zXG5cdFx0XHRtZVxuXHRcdFx0XHQuZmluZFBhcmVudCgnZm9ybScpXG5cdFx0XHRcdC5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuaWQgIT0gbWUuaWQpXG5cdFx0XHRcdFx0XHR0aGlzLmNoYW5nZU90aGVyLmNhbGwodGhpcywgdHJ1ZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdGNoYW5nZU90aGVyOiBmdW5jdGlvbih1c2VyQ2hhbmdlZCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmIChtZS5zaG93SWYpIHtcblx0XHRcdFx0dmFyIHNob3c7XG5cdFx0XHRcdC8qKlxuXHRcdFx0XHQqIFdlIGZvdW5kIGEgc2hvd0lmIGhhc2ggb2JqZWN0LlxuXHRcdFx0XHQqIFRoZXNlIHVzdWFsbHkgbG9vayBsaWtlOlxuXHRcdFx0XHQqXG5cdFx0XHRcdCpcdHtmb286ICdiYXInLCBiYXo6ICdxdXonfSAvLyBPbmx5IHNob3cgaWYgZm9vPWJhciBBTkQgYmF6PXF1elxuXHRcdFx0XHQqXHR7J2ZvbyBpcyc6ICdlbXB0eSd9IC8vIE9ubHkgc2hvdyBvYmplY3QgJ2ZvbycgaGFzIG5vIGNoaWxkcmVuIChhbHNvIGFwcGxpY2FibGU6ICdlbXB0eScsICdub2RhdGEnLCAnbm8gZGF0YScpXG5cdFx0XHRcdCpcdHsnZm9vIGlzJzogJ2VtcHR5J30gLy8gT25seSBzaG93IG9iamVjdCAnZm9vJyBoYXMgU09NRSBjaGlsZHJlbiAoYWxzbyBhcHBsaWNhYmxlOiAnY2hpbGRyZW4nLCAnZGF0YScsICdub3QgZW1wdHknLCAnbm90ZW1wdHknKVxuXHRcdFx0XHQqXG5cdFx0XHRcdCogTk9URTogJ2lzJyBhbmQgJ2hhcycgYXJlIGludGVyY2hhbmdhYmxlIGluIHRoZSBhYm92ZSBzeW50YXguIFNvIHsnZm9vIGhhcyc6ICdubyBjaGlsZHJlbid9IGlzIHRoZSBzYW1lIGFzIHsnZm9vIGlzJzogJ2VtcHR5J31cblx0XHRcdFx0KlxuXHRcdFx0XHQqL1xuXHRcdFx0XHRpZiAodHlwZW9mIG1lLnNob3dJZiA9PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRcdHZhciBmb3JtID0gbWUuZmluZFBhcmVudCgnZm9ybScpO1xuXHRcdFx0XHRcdHNob3cgPSAxO1xuXHRcdFx0XHRcdGZvciAodmFyIGZpZWxkIGluIG1lLnNob3dJZikgeyAvLyBDeWNsZSB0aG91Z2ggYWxsIGZpZWxkcyB1bnRpbCB3ZSBmaW5kIHNvbWV0aGluZyB0aGF0IERPRVNOVCBtYXRjaFxuXHRcdFx0XHRcdFx0dmFyIG1hdGNoZXM7XG5cdFx0XHRcdFx0XHRpZiAobWF0Y2hlcyA9IC9eKC4qKSAoPzppc3xoYXMpJC8uZXhlYyhmaWVsZCkpIHsgLy8gVXNlcyAnaXMnIHN5bnRheFxuXHRcdFx0XHRcdFx0XHR2YXIgb2JqXG5cdFx0XHRcdFx0XHRcdHN3aXRjaCAobWUuc2hvd0lmW2ZpZWxkXSkge1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2NoaWxkcmVuJzpcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdkYXRhJzpcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdub3RlbXB0eSc6XG5cdFx0XHRcdFx0XHRcdFx0Y2FzZSAnbm90IGVtcHR5Jzpcblx0XHRcdFx0XHRcdFx0XHRcdG9iaiA9IGZvcm0uZmluZChtYXRjaGVzWzFdKTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmICghb2JqLmNoaWxkcmVuIHx8ICFPYmplY3Qua2V5cyhvYmouY2hpbGRyZW4pLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRzaG93ID0gMDtcblx0XHRcdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdubyBkYXRhJzpcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdub2RhdGEnOlxuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2VtcHR5Jzpcblx0XHRcdFx0XHRcdFx0XHRcdG9iaiA9IGZvcm0uZmluZChtYXRjaGVzWzFdKTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChvYmouY2hpbGRyZW4gJiYgT2JqZWN0LmtleXMob2JqLmNoaWxkcmVuKS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHNob3cgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ1Vua25vd24gcXVlcnkgc3ludGF4OicsIGZpZWxkLCAnPScsICBtZS5zaG93SWZbZmllbGRdKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChtZS5zaG93SWZbZmllbGRdICE9IGZvcm0uZmluZChmaWVsZCkudmFsdWUpIHsgLy8gU3RhbmRhcmQga2V5PXZhbFxuXHRcdFx0XHRcdFx0XHRzaG93ID0gMDtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBtZS5zaG93SWYgPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdHNob3cgPSBtZS5zaG93SWYuY2FsbChtZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRtZS5zaG93KHNob3csIHVzZXJDaGFuZ2VkKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRzaG93OiBmdW5jdGlvbih2aXNpYmxlLCBhbmltYXRlKSB7XG5cdFx0XHRpZiAodmlzaWJsZSB8fCB2aXNpYmxlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0aWYgKGFuaW1hdGUpIHtcblx0XHRcdFx0XHQodGhpcy53cmFwcGVyIHx8IHRoaXMuZWxlbWVudCkuc2xpZGVEb3duKCk7XG5cdFx0XHRcdH0gZWxzZSBcblx0XHRcdFx0XHQodGhpcy53cmFwcGVyIHx8IHRoaXMuZWxlbWVudCkuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGFuaW1hdGUpIHtcblx0XHRcdFx0XHQodGhpcy53cmFwcGVyIHx8IHRoaXMuZWxlbWVudCkuc2xpZGVVcCgpO1xuXHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHQodGhpcy53cmFwcGVyIHx8IHRoaXMuZWxlbWVudCkuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8vIFRoaXMgaXMgcmVhbGx5IGp1c3QgYSBkdW1iIGFsaWFzIGZvciBzaG93KDApXG5cdFx0aGlkZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zaG93KGZhbHNlKTtcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBSdW4gYSBjYWxsYmFjayBmdW5jdGlvbiBpZiBpdCBleGlzdHNcblx0XHQqIEBwYXJhbSBzdHJpbmcgbmFtZSB0aGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gKGUuZy4gaWYgJ2ZvbycgdGhlIGZ1bmN0aW9uIGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkICdvbkZvbycpXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdHRyaWdnZXI6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRcdHZhciBmdW5jTmFtZSA9ICdvbicgKyBuYW1lLnN1YnN0cigwLCAxKS50b1VwcGVyQ2FzZSgpICsgbmFtZS5zdWJzdHIoMSk7XG5cdFx0XHRpZiAodHlwZW9mIHRoaXNbZnVuY05hbWVdID09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dGhpc1tmdW5jTmFtZV0uY2FsbCh0aGlzKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblxuXHRcdHJlbmRlclRhZzogJzxzZWxlY3Q+PC9zZWxlY3Q+Jyxcblx0XHRyZW5kZXJJdGVtOiAnPG9wdGlvbiB2YWx1ZT1cInt7ZGF0YS5faWR9fVwiPnt7ZGF0YS50aXRsZX19PC9vcHRpb24+JyxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5lbGVtZW50ID0gJChtZS5yZW5kZXJUYWcpO1xuXHRcdFx0bWUuZWxlbWVudC5vbignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdG1lLnZhbHVlID0gJCh0aGlzKS52YWwoKTtcblx0XHRcdFx0bWUuY2hhbmdlLmNhbGwobWUpO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5sb2FkQ29udGFpbmVyRGF0YShmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGRhdGE7XG5cdFx0XHRcdG1lLmVsZW1lbnQuZW1wdHkoKVxuXHRcdFx0XHRtZS5yZXdpbmREYXRhKCk7XG5cblx0XHRcdFx0d2hpbGUgKGRhdGEgPSBtZS5nZXREYXRhKCkpIHtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZCgkKG1lLnBhcnNlKG1lLnJlbmRlckl0ZW0pKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobWUudmFsdWUpIHtcblx0XHRcdFx0XHRtZS5lbGVtZW50LnZhbChtZS52YWx1ZSk7XG5cdFx0XHRcdH0gZWxzZSB7IC8vIE5vIHZhbHVlIC0gc2VsZWN0IHRoZSBmaXJzdFxuXHRcdFx0XHRcdG1lLmVsZW1lbnRcblx0XHRcdFx0XHRcdC52YWwoIG1lLmVsZW1lbnQuZmluZCgnb3B0aW9uOmZpcnN0JykuYXR0cigndmFsdWUnKSApXG5cdFx0XHRcdFx0XHQudHJpZ2dlcignY2hhbmdlJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnJlbmRlci5jYWxsKHRoaXMpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ3R5cGUnLCAndGV4dCcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb2x1bW5zOiB7fSwgLy8gV2hlcmUgdGhlIHJhdyBvYmplY3RzIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIGNoaWxkcmVuIHJlc2lkZVxuXHRcdGNvbHVtbk9yZGVyOiBbXSxcblxuXHRcdHJlbmRlclRhZzogJzx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLWJvcmRlcmVkIHRhYmxlLXN0cmlwZWRcIj48L3RhYmxlPicsXG5cblx0XHRhdXRvSGlkZTogdHJ1ZSxcblxuXHRcdHJlZnJlc2g6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5jb2x1bW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNvbHVtbk9yZGVyID0gT2JqZWN0LmtleXMobWUuY29sdW1ucyk7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybignTm8gY29sdW1uT3JkZXIgc3BlY2lmaWVkLiBJbmhlcml0aW5nIGZyb20gY29sdW1ucyBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFtZS5lbGVtZW50KVxuXHRcdFx0XHRtZS5lbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cIndlbGxcIj48aDM+TG9hZGluZyB0YWJsZS4uLjwvaDM+PC9kaXY+Jyk7XG5cblx0XHRcdGlmICghbWUuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnYmF0dF90YWJsZT4gTm8gZGF0YVNvdXJjZSBzcGVjaWZpZWQgLSBXaGF0IGRpZCB5b3Ugd2FudCBtZSB0byByZW5kZXIgZXhhY3RseT8nLCBtZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZS5sb2FkQ29udGFpbmVyRGF0YShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHQvLyBLaWxsIGFsbCBjaGlsZHJlbiBhbmQgcmVnZW5lcmF0ZVxuXHRcdFx0XHRcdG1lLmNoaWxkcmVuID0ge307XG5cdFx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IFtdO1xuXG5cdFx0XHRcdFx0dmFyIGRhdGE7XG5cdFx0XHRcdFx0d2hpbGUgKGRhdGEgPSBtZS5nZXREYXRhKCkpIHtcblx0XHRcdFx0XHRcdHZhciByb3dJZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2JhdHQtdGFibGUtcm93LScpO1xuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5bcm93SWRdID0gYmF0dC5tYWtlT2JqZWN0KCdjb250YWluZXInKTtcblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuW3Jvd0lkXS5yZW5kZXJUYWcgPSAnPHRyPjwvdHI+Jztcblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIucHVzaChyb3dJZCk7XG5cblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuW3Jvd0lkXS5zZXQobWUuY29sdW1ucyk7IC8vIENvcHkgY29sdW1uIHByb3RvdHlwZSBpbnRvIG5ldyBjaGlsZFxuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuW3Jvd0lkXS5jaGlsZHJlbikge1xuXHRcdFx0XHRcdFx0XHRtZS5jaGlsZHJlbltyb3dJZF0uY2hpbGRyZW5bY10uY29udGFpbmVyRHJhdyA9ICd0YWJsZS1jZWxsJztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5bcm93SWRdLmVhY2hDaGlsZChmdW5jdGlvbigpIHsgLy8gQ29weSBkYXRhIGhhc2ggaW50byBjaGlsZHJlblxuXHRcdFx0XHRcdFx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHRcdFx0bWUuY2hhbmdlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0dmFyIHJlZHJhdyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRtZS5lbGVtZW50LmVtcHR5KCk7XG5cdFx0XHRcdG1lLnNob3coKTtcblx0XHRcdFx0aWYgKG1lLmNoaWxkcmVuT3JkZXIubGVuZ3RoKSB7IC8vIEhhcyBjaGlsZHJlblxuXHRcdFx0XHRcdHZhciB0YWJsZUhlYWQgPSAkKCc8dHI+PC90cj4nKVxuXHRcdFx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY29sdW1uT3JkZXIpIHtcblx0XHRcdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNvbHVtbnNbbWUuY29sdW1uT3JkZXJbY11dO1xuXHRcdFx0XHRcdFx0dmFyIHRhYmxlQ2VsbCA9ICQoJzx0aD4nICsgKGNoaWxkLmNvbHVtblRpdGxlIHx8IGNoaWxkLnRpdGxlIHx8ICcmbmJzcDsnKSArICc8L3RoPicpXG5cdFx0XHRcdFx0XHRcdC5hcHBlbmRUbyh0YWJsZUhlYWQpO1xuXHRcdFx0XHRcdFx0aWYgKGNoaWxkLmNvbHVtbldpZHRoKVxuXHRcdFx0XHRcdFx0XHR0YWJsZUNlbGwuYXR0cignd2lkdGgnLCBjaGlsZC5jb2x1bW5XaWR0aCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bWUucmV3aW5kRGF0YSgpO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdFx0XHRjaGlsZC5sb2FkRGF0YSgpO1xuXHRcdFx0XHRcdFx0Y2hpbGQuc2V0dXAoKTtcblx0XHRcdFx0XHRcdGNoaWxkLnJlbmRlcigpO1xuXHRcdFx0XHRcdFx0Y2hpbGQuZWxlbWVudC5hcHBlbmRUbyhtZS5lbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAobWUuYXV0b0hpZGUpIHsgLy8gTm8gZGF0YSAtIGhpZGUgdGhlIGVsZW1lbnQgYXV0b21hdGljYWxseT9cblx0XHRcdFx0XHRtZS5oaWRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpZiAobWUuY2hpbGRyZW4ubGVuZ3RoKSB7IC8vIEFscmVhZHkgaGFzIGNoaWxkcmVuIC0gbm8gbmVlZCB0byByZWRyYXdcblx0XHRcdFx0cmVkcmF3KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZS5yZWZyZXNoKHJlZHJhdyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0ZGVmYXVsdDogMCwgLy8gVGhlIGRlZmF1bHQgdGFiIG9mZnNldCB0byBzZWxlY3Rcblx0XHRyZW5kZXJUYWc6ICc8ZGl2PjwvZGl2PicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghbWUuY2hpbGRyZW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIgPSBPYmplY3Qua2V5cyhtZS5jaGlsZHJlbik7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gY2hpbGRyZW5PcmRlciBzcGVjaWZpZWQuIEluaGVyaXRpbmcgZnJvbSBjaGlsZHJlbiBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpO1xuXG5cdFx0XHQvLyBEcmF3IHRhYiBzZWxlY3Rpb24gcGFuZSB7e3tcblx0XHRcdHZhciB0YWJIZWFkID0gJCgnPHVsIGNsYXNzPVwibmF2IG5hdi10YWJzXCI+PC91bD4nKVxuXHRcdFx0XHQuYXBwZW5kVG8obWUuZWxlbWVudCk7XG5cdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdGNoaWxkLmxpbmtIYXNoID0gYmF0dC5zYWZlU3RyaW5nKGNoaWxkLnRpdGxlKTtcblx0XHRcdFx0dGFiSGVhZC5hcHBlbmQoJzxsaT48YSBocmVmPVwiIycgKyBjaGlsZC5saW5rSGFzaCArICdcIiBkYXRhLXRvZ2dsZT1cInRhYlwiPicgKyBjaGlsZC50aXRsZSArICc8L2E+PC9saT4nKTtcblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXHRcdFx0Ly8gRHJhdyBhY3R1YWwgdGFicyB7e3tcblx0XHRcdHZhciB0YWJCb2R5ID0gJCgnPGRpdiBjbGFzcz1cInRhYi1jb250ZW50XCI+PC9kaXY+Jylcblx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXHRcdFx0Zm9yICh2YXIgYyBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbY11dO1xuXHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblx0XHRcdFx0dmFyIHRhYkNvbnRlbnQgPSAkKCc8ZGl2IGNsYXNzPVwidGFiLXBhbmVcIiBpZD1cIicgKyBjaGlsZC5saW5rSGFzaCArICdcIj48L2Rpdj4nKVxuXHRcdFx0XHRcdC5hcHBlbmRUbyh0YWJCb2R5KTtcblx0XHRcdFx0bWUucmVuZGVyUm93KHRhYkNvbnRlbnQsIGNoaWxkKTtcblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXHRcdFx0Ly8gU2VsZWN0IGRlZmF1bHQgdGFiIHt7e1xuXHRcdFx0dGFiSGVhZC5maW5kKCdhW2RhdGEtdG9nZ2xlPVwidGFiXCJdJykuZXEobWUuZGVmYXVsdCkudGFiKCdzaG93Jyk7XG5cdFx0XHR0YWJCb2R5LmZpbmQoJ2Rpdi50YWItcGFuZScpLmVxKG1lLmRlZmF1bHQpLmFkZENsYXNzKCdhY3RpdmUnKTtcblx0XHRcdC8vIH19fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdub3JtYWwnLFxuXHRcdGFjdGlvbjogJ25vdGhpbmcnLFxuXHRcdGNsYXNzZXM6ICdiYWRnZScsXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc3VwZXIucmVuZGVyLmNhbGwodGhpcyk7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzx0ZXh0YXJlYT48L3RleHRhcmVhPicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnRcblx0XHRcdFx0Lmh0bWwodGhpcy52YWx1ZSlcblx0XHRcdFx0Lm9uKCdjaGFuZ2UnLCB0aGlzLmNoYW5nZSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Y2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmVsZW1lbnQudmFsKCk7XG5cdFx0XHR0aGlzLnN1cGVyLmNoYW5nZS5jYWxsKHRoaXMpO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb250YWluZXJEcmF3OiAnc3BhbicsXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cImFsZXJ0IGFsZXJ0LWRhbmdlclwiPjxpIGNsYXNzPVwiaWNvbi13YXJuaW5nLXNpZ25cIj48L2k+IElEOiBcXCcnICsgdGhpcy5pZCArICdcXCcgQXR0ZW1wdGVkIHRvIGxvYWQgbm9uZS1leGlzdGFudCBCYXR0IGZvcm0gdHlwZSBcXCcnICsgdGhpcy50eXBlRmFpbGVkICsgJ1xcJzwvZGl2PicpO1xuXHRcdFx0aWYgKHRoaXMuY2hpbGRyZW4pIHtcblx0XHRcdFx0Zm9yICh2YXIgYyBpbiB0aGlzLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0dmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltjXTtcblx0XHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCc8YnIvPjxzdHJvbmc+Q0hJTEQ6PC9zdHJvbmc+ICcgKyBjaGlsZC50eXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNldDogZnVuY3Rpb24oKSB7XG5cdFx0XHQvLyBOby1vcFxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iXX0=
;