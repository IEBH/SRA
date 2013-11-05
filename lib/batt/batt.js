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

var batt_checkbox = require('./batt_checkbox.js');
batt_checkbox.prototype = new batt_object();
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
		checkbox: {inherits: 'object', object: require('./batt_checkbox.js')},
		choice: {inherits: 'object', object: require('./batt_choice.js')},
		choice_radio: {inherits: 'object', object: require('./batt_choice_radio.js')},
		container: {inherits: 'object', object: require('./batt_container.js')},
		container_splitter: {inherits: 'container', object: require('./batt_container_splitter.js')},
		date: {inherits: 'object', object: require('./batt_date.js')},
		dropdown: {inherits: 'container', object: require('./batt_dropdown.js')},
		email: {inherits: 'input', object: require('./batt_email.js')},
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
			obj = batt.makeObject('unknown');
			obj.typeFailed = type;
			return obj;
		} else {
			if (batt.widgets[type].inherits)
				batt.widgets[type].object.prototype = new batt.widgets[batt.widgets[type].inherits].object();
			obj = new batt.widgets[type].object();
		}
		obj.type = type;
		if (batt.widgets[type].inherits) { // Glue prototype accessor to .super
			var proto = new batt.widgets[batt.widgets[type].inherits].object();
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
				var form = {action: script.attr('action')};
				batt.loadScriptsInline.push(
					'$(\'#' + newId + '\').batt(' + script.html() + ', ' + JSON.stringify(form) + ');'
				);
				script.remove();
			}
		});
		if (ready) {
			// Install global error handler {{{
			if ($.browser.chrome) {
				$(window).on('error', function(e) {
					batt.globalErrorHandler(e.originalEvent.message, null, e.originalEvent.lineno);
				});
			} else if ($.browser.mozilla) {
				window.onerror = batt.globalErrorHandler;
			}
			// }}}
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

	// Special functions {{{
	globalErrorHandler: function(message, file, line) {
		batt.stop = 1;
		if (batt.evalInfo) { // We have something to complain about
			var box = $(batt.evalInfo.id);
			message = message.replace(/^Uncaught SyntaxError: /, '');
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
	},
	// }}}
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
	/**
	* Convenience constructor to invoke Batt on an element
	* @param string json RAW Batt JSON speification
	* @param object formObject Additional parameters to import when creating the wrapper form e.g. {action: '/submit/here'}
	*/
	batt: function(json, formObject) {
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
				if (formObject)
					$.extend(batt.forms[id], formObject);
				batt.forms[id].setup.call(batt.forms[id], me);
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

},{"./batt_button.js":4,"./batt_checkbox.js":5,"./batt_choice.js":6,"./batt_choice_radio.js":7,"./batt_container.js":8,"./batt_container_splitter.js":9,"./batt_date.js":10,"./batt_dropdown.js":11,"./batt_email.js":12,"./batt_feed.js":13,"./batt_feed_batt.js":14,"./batt_file.js":15,"./batt_form.js":16,"./batt_heading.js":17,"./batt_html.js":18,"./batt_input.js":19,"./batt_label.js":20,"./batt_link.js":21,"./batt_number.js":22,"./batt_object.js":23,"./batt_reference.js":24,"./batt_string.js":25,"./batt_table.js":26,"./batt_tabs.js":27,"./batt_tag.js":28,"./batt_text.js":29,"./batt_unknown.js":30,"mustache":1}],4:[function(require,module,exports){
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
		containerDraw: 'hide-label',
		value: null, // Value can only be '0' or '1'

		required: false,
		readOnly: null,
		errorRequired: 'String required',

		change: function() {
			this.value = this.element.find('input[type=checkbox]').is(':checked') ? '1' : '0';
			this.super.change.call(this);
		},

		setup: function() {
			var me = this;
			me
				.element = $('<label class="checkbox"><input type="checkbox"/> ' + me.title + '</label>')
				.on('change', function() {
					me.change.call(me);
				});
			return me;
		},

		render: function() {
			var me = this;
			if (me.value) {
				me.element.attr('checked', 'checked');
				me.value = '1';
			} else {
				me.element.removeAttr('checked');
				me.value = '0';
			}

			if (me.readOnly)
				me.element
					.attr('readonly', 'readonly')

					.addClass('disabledInput');
			return me;
		},

		validate: function() {
			if (this.required && !this.value)
				return this.errorRequired;
		}
	}, parameters);

	return this;
};

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		setup: function() {
			this.super.setup.call(this);
			this.element.attr('type', 'email');
		},

		render: function() {
			this.super.render.call(this);
			return this;
		}
	}, parameters);

	return this;
};

},{}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
var simpleJsonFilter = require('simple-json-filter');

module.exports = function(parameters) {
	$.extend(this, {
		url: '/batt/api/feed',
		key: 'id',
		order: 'id',
		table: null, // Override if the remote table doesnt match this objects id
		fussy: 'auto', // Apply filters to incomming JSON stream (i.e. dont trust the server to return the right data). True, false or "auto" (true if url ends with '.json')

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
					order: dataSource.order || me.order,
					table: me.table || me.id,
					joins: $.extend({}, me.joins, dataSource.joins),
					filters: $.extend({}, me.filters, dataSource.filters),
					fields: $.extend({}, me.fields, dataSource.fields)
				},
				success: function(json) {
					if (
						(me.fussy === true)
						|| (me.fussy === 'auto' && /\.json$/.exec(me.url)) // me.fussy==auto (and the URL ends with .json)
					) {
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

},{"simple-json-filter":2}],15:[function(require,module,exports){
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
						var addChild = true;
						// FIX: Dont add any more children if the last item in the sequence doesn't have a value - This is to fix the issue where changing an existing file upload box would keep adding children to the end of the container parent {{{
						var originalElement = me;
						while (originalElement.cloneOf) // This element is actually a clone - find the original
							originalElement = batt.find(originalElement.cloneOf);

						var myParent = me.parent();
						var children = $.extend([], myParent.childrenOrder);
						children.reverse();
						for (var c in children) {
							var child = myParent.children[children[c]];
							if (child.cloneOf == originalElement.id) {
								console.log('FOUND FIRST CLONE', child.id);
								if (!child.value)
									addChild = false;
								break;
							}
						}
						// }}}
						if (addChild)
							me.parent()
								.addChild($.extend({}, me, {
									id: batt.getUniqueId(me.id),
									value: null,
									cloneOf: originalElement.id
								}), 'after', me.id)
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

},{}],16:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		method: 'POST', // POST - Regular HTML submit, BATT - internal AJAX calls to a Batt server
		action: '?', // If type=html this is the location where the form will be submitted.
		renderTag: '<form action="{{{action}}}" method="{{method}}" class="form-horizontal" enctype="multipart/form-data"></form>',

		submit: function() {
			var me = this;
			if (me.validate()) {
				console.log('SUBMIT> OK');

				switch (me.method.toUpperCase()) {
					case 'POST':
						me.eachChild(function() {
							if (!this.idFake)
								me.element.append('<input type="hidden" name="' + this.id + '" value="' + (this.value !== null ? this.value : '') + '"/>');
						});
						break;
					case 'BATT':
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
						break;
					case 'BATT-LEGACY':
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
			} else {
				console.log('SUBMIT> FAIL');
			}
		},

		setup: function(formParent) {
			var me = this;
			me.element = $(me.parse(me.renderTag));
			me.element.on('submit', function(e) {
				me.submit.call(me);
				if (me.method == 'BATT')
					e.preventDefault();
			});
			if (formParent)
				me.element.appendTo(formParent);
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

},{}],17:[function(require,module,exports){
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

},{}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		placeholder: null,
		classes: null,
		required: false,
		lengthMax: null,
		lengthMin: null,
		readOnly: null,
		errorRequired: 'String required',
		errorLengthMax: 'String too long',
		errorLengthMin: 'String too short',

		change: function() {
			this.value = this.element.val();
			this.super.change.call(this);
		},

		setup: function() {
			var me = this;
			me
				.element = $('<input/>')
				.on('change', function() {
					me.change.call(me);
				});
			return me;
		},

		render: function() {
			var me = this;
			if (me.value)
				me.element.attr('value', me.value);
			if (me.placeholder)
				me.element.attr('placeholder', me.placeholder);
			if (me.readOnly)
				me.element
					.attr('readonly', 'readonly')
					.addClass('disabledInput');
			if (me.dataBinding)
				me.element.attr('batt-data-binding', me.dataBinding);
			if (me.classes)
				me.element.addClass(me.classes);
			return me;
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

},{}],20:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		text: null,
		containerDraw: 'normal',
		action: 'nothing',
		classes: null,
		icon: null,

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

			if (me.icon)
				me.element.prepend('<i class="' + me.icon + '"></i>');
			
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
						me.findParent('form').element.trigger('submit');
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

},{}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
module.exports = function(parameters) {
	$.extend(this, {
		setup: function() {
			this.super.setup.call(this);
			this.element.attr('type', 'text');
		},

		render: function() {
			this.super.render.call(this);
			return this;
		}
	}, parameters);

	return this;
};

},{}],26:[function(require,module,exports){
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

},{}],27:[function(require,module,exports){
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

},{}],28:[function(require,module,exports){
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

},{}],29:[function(require,module,exports){
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

},{}],30:[function(require,module,exports){
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
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvbm9kZV9tb2R1bGVzL211c3RhY2hlL211c3RhY2hlLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L25vZGVfbW9kdWxlcy9zaW1wbGUtanNvbi1maWx0ZXIvaW5kZXguanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfYnV0dG9uLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2NoZWNrYm94LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2Nob2ljZS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9jaG9pY2VfcmFkaW8uanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfY29udGFpbmVyLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2NvbnRhaW5lcl9zcGxpdHRlci5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9kYXRlLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2Ryb3Bkb3duLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2VtYWlsLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2ZlZWQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfZmVlZF9iYXR0LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2ZpbGUuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfZm9ybS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9oZWFkaW5nLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2h0bWwuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfaW5wdXQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfbGFiZWwuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfbGluay5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9udW1iZXIuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfb2JqZWN0LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X3JlZmVyZW5jZS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9zdHJpbmcuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGFibGUuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGFicy5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF90YWcuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGV4dC5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF91bmtub3duLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25PQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiLyohXG4gKiBtdXN0YWNoZS5qcyAtIExvZ2ljLWxlc3Mge3ttdXN0YWNoZX19IHRlbXBsYXRlcyB3aXRoIEphdmFTY3JpcHRcbiAqIGh0dHA6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanNcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmU6IGZhbHNlKi9cblxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIiAmJiBleHBvcnRzKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5OyAvLyBDb21tb25KU1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZhY3RvcnkpOyAvLyBBTURcbiAgfSBlbHNlIHtcbiAgICByb290Lk11c3RhY2hlID0gZmFjdG9yeTsgLy8gPHNjcmlwdD5cbiAgfVxufSh0aGlzLCAoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBleHBvcnRzID0ge307XG5cbiAgZXhwb3J0cy5uYW1lID0gXCJtdXN0YWNoZS5qc1wiO1xuICBleHBvcnRzLnZlcnNpb24gPSBcIjAuNy4yXCI7XG4gIGV4cG9ydHMudGFncyA9IFtcInt7XCIsIFwifX1cIl07XG5cbiAgZXhwb3J0cy5TY2FubmVyID0gU2Nhbm5lcjtcbiAgZXhwb3J0cy5Db250ZXh0ID0gQ29udGV4dDtcbiAgZXhwb3J0cy5Xcml0ZXIgPSBXcml0ZXI7XG5cbiAgdmFyIHdoaXRlUmUgPSAvXFxzKi87XG4gIHZhciBzcGFjZVJlID0gL1xccysvO1xuICB2YXIgbm9uU3BhY2VSZSA9IC9cXFMvO1xuICB2YXIgZXFSZSA9IC9cXHMqPS87XG4gIHZhciBjdXJseVJlID0gL1xccypcXH0vO1xuICB2YXIgdGFnUmUgPSAvI3xcXF58XFwvfD58XFx7fCZ8PXwhLztcblxuICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2lzc3Vlcy5hcGFjaGUub3JnL2ppcmEvYnJvd3NlL0NPVUNIREItNTc3XG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg5XG4gIGZ1bmN0aW9uIHRlc3RSZShyZSwgc3RyaW5nKSB7XG4gICAgcmV0dXJuIFJlZ0V4cC5wcm90b3R5cGUudGVzdC5jYWxsKHJlLCBzdHJpbmcpO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNXaGl0ZXNwYWNlKHN0cmluZykge1xuICAgIHJldHVybiAhdGVzdFJlKG5vblNwYWNlUmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZVJlKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvW1xcLVxcW1xcXXt9KCkqKz8uLFxcXFxcXF4kfCNcXHNdL2csIFwiXFxcXCQmXCIpO1xuICB9XG5cbiAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICBcIiZcIjogXCImYW1wO1wiLFxuICAgIFwiPFwiOiBcIiZsdDtcIixcbiAgICBcIj5cIjogXCImZ3Q7XCIsXG4gICAgJ1wiJzogJyZxdW90OycsXG4gICAgXCInXCI6ICcmIzM5OycsXG4gICAgXCIvXCI6ICcmI3gyRjsnXG4gIH07XG5cbiAgZnVuY3Rpb24gZXNjYXBlSHRtbChzdHJpbmcpIHtcbiAgICByZXR1cm4gU3RyaW5nKHN0cmluZykucmVwbGFjZSgvWyY8PlwiJ1xcL10vZywgZnVuY3Rpb24gKHMpIHtcbiAgICAgIHJldHVybiBlbnRpdHlNYXBbc107XG4gICAgfSk7XG4gIH1cblxuICAvLyBFeHBvcnQgdGhlIGVzY2FwaW5nIGZ1bmN0aW9uIHNvIHRoYXQgdGhlIHVzZXIgbWF5IG92ZXJyaWRlIGl0LlxuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzI0NFxuICBleHBvcnRzLmVzY2FwZSA9IGVzY2FwZUh0bWw7XG5cbiAgZnVuY3Rpb24gU2Nhbm5lcihzdHJpbmcpIHtcbiAgICB0aGlzLnN0cmluZyA9IHN0cmluZztcbiAgICB0aGlzLnRhaWwgPSBzdHJpbmc7XG4gICAgdGhpcy5wb3MgPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSB0YWlsIGlzIGVtcHR5IChlbmQgb2Ygc3RyaW5nKS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLmVvcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWlsID09PSBcIlwiO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmllcyB0byBtYXRjaCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBSZXR1cm5zIHRoZSBtYXRjaGVkIHRleHQgaWYgaXQgY2FuIG1hdGNoLCB0aGUgZW1wdHkgc3RyaW5nIG90aGVyd2lzZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW4gPSBmdW5jdGlvbiAocmUpIHtcbiAgICB2YXIgbWF0Y2ggPSB0aGlzLnRhaWwubWF0Y2gocmUpO1xuXG4gICAgaWYgKG1hdGNoICYmIG1hdGNoLmluZGV4ID09PSAwKSB7XG4gICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICB0aGlzLnBvcyArPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgICByZXR1cm4gbWF0Y2hbMF07XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNraXBzIGFsbCB0ZXh0IHVudGlsIHRoZSBnaXZlbiByZWd1bGFyIGV4cHJlc3Npb24gY2FuIGJlIG1hdGNoZWQuIFJldHVybnNcbiAgICogdGhlIHNraXBwZWQgc3RyaW5nLCB3aGljaCBpcyB0aGUgZW50aXJlIHRhaWwgaWYgbm8gbWF0Y2ggY2FuIGJlIG1hZGUuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuVW50aWwgPSBmdW5jdGlvbiAocmUpIHtcbiAgICB2YXIgbWF0Y2gsIHBvcyA9IHRoaXMudGFpbC5zZWFyY2gocmUpO1xuXG4gICAgc3dpdGNoIChwb3MpIHtcbiAgICBjYXNlIC0xOlxuICAgICAgbWF0Y2ggPSB0aGlzLnRhaWw7XG4gICAgICB0aGlzLnBvcyArPSB0aGlzLnRhaWwubGVuZ3RoO1xuICAgICAgdGhpcy50YWlsID0gXCJcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMDpcbiAgICAgIG1hdGNoID0gXCJcIjtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBtYXRjaCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoMCwgcG9zKTtcbiAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcocG9zKTtcbiAgICAgIHRoaXMucG9zICs9IHBvcztcbiAgICB9XG5cbiAgICByZXR1cm4gbWF0Y2g7XG4gIH07XG5cbiAgZnVuY3Rpb24gQ29udGV4dCh2aWV3LCBwYXJlbnQpIHtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xuICB9XG5cbiAgQ29udGV4dC5tYWtlID0gZnVuY3Rpb24gKHZpZXcpIHtcbiAgICByZXR1cm4gKHZpZXcgaW5zdGFuY2VvZiBDb250ZXh0KSA/IHZpZXcgOiBuZXcgQ29udGV4dCh2aWV3KTtcbiAgfTtcblxuICBDb250ZXh0LnByb3RvdHlwZS5jbGVhckNhY2hlID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX2NhY2hlID0ge307XG4gIH07XG5cbiAgQ29udGV4dC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uICh2aWV3KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZXh0KHZpZXcsIHRoaXMpO1xuICB9O1xuXG4gIENvbnRleHQucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdmFyIHZhbHVlID0gdGhpcy5fY2FjaGVbbmFtZV07XG5cbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICBpZiAobmFtZSA9PT0gXCIuXCIpIHtcbiAgICAgICAgdmFsdWUgPSB0aGlzLnZpZXc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXM7XG5cbiAgICAgICAgd2hpbGUgKGNvbnRleHQpIHtcbiAgICAgICAgICBpZiAobmFtZS5pbmRleE9mKFwiLlwiKSA+IDApIHtcbiAgICAgICAgICAgIHZhciBuYW1lcyA9IG5hbWUuc3BsaXQoXCIuXCIpLCBpID0gMDtcblxuICAgICAgICAgICAgdmFsdWUgPSBjb250ZXh0LnZpZXc7XG5cbiAgICAgICAgICAgIHdoaWxlICh2YWx1ZSAmJiBpIDwgbmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gdmFsdWVbbmFtZXNbaSsrXV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlID0gY29udGV4dC52aWV3W25hbWVdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5fY2FjaGVbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUuY2FsbCh0aGlzLnZpZXcpO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICBmdW5jdGlvbiBXcml0ZXIoKSB7XG4gICAgdGhpcy5jbGVhckNhY2hlKCk7XG4gIH1cblxuICBXcml0ZXIucHJvdG90eXBlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fY2FjaGUgPSB7fTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLmNvbXBpbGUgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB2YXIgZm4gPSB0aGlzLl9jYWNoZVt0ZW1wbGF0ZV07XG5cbiAgICBpZiAoIWZuKSB7XG4gICAgICB2YXIgdG9rZW5zID0gZXhwb3J0cy5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gICAgICBmbiA9IHRoaXMuX2NhY2hlW3RlbXBsYXRlXSA9IHRoaXMuY29tcGlsZVRva2Vucyh0b2tlbnMsIHRlbXBsYXRlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZm47XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5jb21waWxlUGFydGlhbCA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZSwgdGFncykge1xuICAgIHZhciBmbiA9IHRoaXMuY29tcGlsZSh0ZW1wbGF0ZSwgdGFncyk7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlW25hbWVdID0gZm47XG4gICAgcmV0dXJuIGZuO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuY29tcGlsZVRva2VucyA9IGZ1bmN0aW9uICh0b2tlbnMsIHRlbXBsYXRlKSB7XG4gICAgdmFyIGZuID0gY29tcGlsZVRva2Vucyh0b2tlbnMpO1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHJldHVybiBmdW5jdGlvbiAodmlldywgcGFydGlhbHMpIHtcbiAgICAgIGlmIChwYXJ0aWFscykge1xuICAgICAgICBpZiAodHlwZW9mIHBhcnRpYWxzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICBzZWxmLl9sb2FkUGFydGlhbCA9IHBhcnRpYWxzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gcGFydGlhbHMpIHtcbiAgICAgICAgICAgIHNlbGYuY29tcGlsZVBhcnRpYWwobmFtZSwgcGFydGlhbHNbbmFtZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZm4oc2VsZiwgQ29udGV4dC5tYWtlKHZpZXcpLCB0ZW1wbGF0ZSk7XG4gICAgfTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpIHtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlKHRlbXBsYXRlKSh2aWV3LCBwYXJ0aWFscyk7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5fc2VjdGlvbiA9IGZ1bmN0aW9uIChuYW1lLCBjb250ZXh0LCB0ZXh0LCBjYWxsYmFjaykge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKG5hbWUpO1xuXG4gICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgdmFyIGJ1ZmZlciA9IFwiXCI7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgYnVmZmVyICs9IGNhbGxiYWNrKHRoaXMsIGNvbnRleHQucHVzaCh2YWx1ZVtpXSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHZhbHVlID8gY2FsbGJhY2sodGhpcywgY29udGV4dC5wdXNoKHZhbHVlKSkgOiBcIlwiO1xuICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHNjb3BlZFJlbmRlciA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSkge1xuICAgICAgICByZXR1cm4gc2VsZi5yZW5kZXIodGVtcGxhdGUsIGNvbnRleHQpO1xuICAgICAgfTtcblxuICAgICAgdmFyIHJlc3VsdCA9IHZhbHVlLmNhbGwoY29udGV4dC52aWV3LCB0ZXh0LCBzY29wZWRSZW5kZXIpO1xuICAgICAgcmV0dXJuIHJlc3VsdCAhPSBudWxsID8gcmVzdWx0IDogXCJcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayh0aGlzLCBjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl9pbnZlcnRlZCA9IGZ1bmN0aW9uIChuYW1lLCBjb250ZXh0LCBjYWxsYmFjaykge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKG5hbWUpO1xuXG4gICAgLy8gVXNlIEphdmFTY3JpcHQncyBkZWZpbml0aW9uIG9mIGZhbHN5LiBJbmNsdWRlIGVtcHR5IGFycmF5cy5cbiAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4NlxuICAgIGlmICghdmFsdWUgfHwgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayh0aGlzLCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl9wYXJ0aWFsID0gZnVuY3Rpb24gKG5hbWUsIGNvbnRleHQpIHtcbiAgICBpZiAoIShuYW1lIGluIHRoaXMuX3BhcnRpYWxDYWNoZSkgJiYgdGhpcy5fbG9hZFBhcnRpYWwpIHtcbiAgICAgIHRoaXMuY29tcGlsZVBhcnRpYWwobmFtZSwgdGhpcy5fbG9hZFBhcnRpYWwobmFtZSkpO1xuICAgIH1cblxuICAgIHZhciBmbiA9IHRoaXMuX3BhcnRpYWxDYWNoZVtuYW1lXTtcblxuICAgIHJldHVybiBmbiA/IGZuKGNvbnRleHQpIDogXCJcIjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl9uYW1lID0gZnVuY3Rpb24gKG5hbWUsIGNvbnRleHQpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cChuYW1lKTtcblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKGNvbnRleHQudmlldyk7XG4gICAgfVxuXG4gICAgcmV0dXJuICh2YWx1ZSA9PSBudWxsKSA/IFwiXCIgOiBTdHJpbmcodmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuX2VzY2FwZWQgPSBmdW5jdGlvbiAobmFtZSwgY29udGV4dCkge1xuICAgIHJldHVybiBleHBvcnRzLmVzY2FwZSh0aGlzLl9uYW1lKG5hbWUsIGNvbnRleHQpKTtcbiAgfTtcblxuICAvKipcbiAgICogTG93LWxldmVsIGZ1bmN0aW9uIHRoYXQgY29tcGlsZXMgdGhlIGdpdmVuIGB0b2tlbnNgIGludG8gYSBmdW5jdGlvblxuICAgKiB0aGF0IGFjY2VwdHMgdGhyZWUgYXJndW1lbnRzOiBhIFdyaXRlciwgYSBDb250ZXh0LCBhbmQgdGhlIHRlbXBsYXRlLlxuICAgKi9cbiAgZnVuY3Rpb24gY29tcGlsZVRva2Vucyh0b2tlbnMpIHtcbiAgICB2YXIgc3ViUmVuZGVycyA9IHt9O1xuXG4gICAgZnVuY3Rpb24gc3ViUmVuZGVyKGksIHRva2VucywgdGVtcGxhdGUpIHtcbiAgICAgIGlmICghc3ViUmVuZGVyc1tpXSkge1xuICAgICAgICB2YXIgZm4gPSBjb21waWxlVG9rZW5zKHRva2Vucyk7XG4gICAgICAgIHN1YlJlbmRlcnNbaV0gPSBmdW5jdGlvbiAod3JpdGVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgcmV0dXJuIGZuKHdyaXRlciwgY29udGV4dCwgdGVtcGxhdGUpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc3ViUmVuZGVyc1tpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKHdyaXRlciwgY29udGV4dCwgdGVtcGxhdGUpIHtcbiAgICAgIHZhciBidWZmZXIgPSBcIlwiO1xuICAgICAgdmFyIHRva2VuLCBzZWN0aW9uVGV4dDtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRva2Vucy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgICBzd2l0Y2ggKHRva2VuWzBdKSB7XG4gICAgICAgIGNhc2UgXCIjXCI6XG4gICAgICAgICAgc2VjdGlvblRleHQgPSB0ZW1wbGF0ZS5zbGljZSh0b2tlblszXSwgdG9rZW5bNV0pO1xuICAgICAgICAgIGJ1ZmZlciArPSB3cml0ZXIuX3NlY3Rpb24odG9rZW5bMV0sIGNvbnRleHQsIHNlY3Rpb25UZXh0LCBzdWJSZW5kZXIoaSwgdG9rZW5bNF0sIHRlbXBsYXRlKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJeXCI6XG4gICAgICAgICAgYnVmZmVyICs9IHdyaXRlci5faW52ZXJ0ZWQodG9rZW5bMV0sIGNvbnRleHQsIHN1YlJlbmRlcihpLCB0b2tlbls0XSwgdGVtcGxhdGUpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIj5cIjpcbiAgICAgICAgICBidWZmZXIgKz0gd3JpdGVyLl9wYXJ0aWFsKHRva2VuWzFdLCBjb250ZXh0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIiZcIjpcbiAgICAgICAgICBidWZmZXIgKz0gd3JpdGVyLl9uYW1lKHRva2VuWzFdLCBjb250ZXh0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIm5hbWVcIjpcbiAgICAgICAgICBidWZmZXIgKz0gd3JpdGVyLl9lc2NhcGVkKHRva2VuWzFdLCBjb250ZXh0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcInRleHRcIjpcbiAgICAgICAgICBidWZmZXIgKz0gdG9rZW5bMV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1zIHRoZSBnaXZlbiBhcnJheSBvZiBgdG9rZW5zYCBpbnRvIGEgbmVzdGVkIHRyZWUgc3RydWN0dXJlIHdoZXJlXG4gICAqIHRva2VucyB0aGF0IHJlcHJlc2VudCBhIHNlY3Rpb24gaGF2ZSB0d28gYWRkaXRpb25hbCBpdGVtczogMSkgYW4gYXJyYXkgb2ZcbiAgICogYWxsIHRva2VucyB0aGF0IGFwcGVhciBpbiB0aGF0IHNlY3Rpb24gYW5kIDIpIHRoZSBpbmRleCBpbiB0aGUgb3JpZ2luYWxcbiAgICogdGVtcGxhdGUgdGhhdCByZXByZXNlbnRzIHRoZSBlbmQgb2YgdGhhdCBzZWN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gbmVzdFRva2Vucyh0b2tlbnMpIHtcbiAgICB2YXIgdHJlZSA9IFtdO1xuICAgIHZhciBjb2xsZWN0b3IgPSB0cmVlO1xuICAgIHZhciBzZWN0aW9ucyA9IFtdO1xuXG4gICAgdmFyIHRva2VuO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0b2tlbnMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuICAgICAgc3dpdGNoICh0b2tlblswXSkge1xuICAgICAgY2FzZSAnIyc6XG4gICAgICBjYXNlICdeJzpcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgICAgY29sbGVjdG9yID0gdG9rZW5bNF0gPSBbXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcvJzpcbiAgICAgICAgdmFyIHNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcbiAgICAgICAgc2VjdGlvbls1XSA9IHRva2VuWzJdO1xuICAgICAgICBjb2xsZWN0b3IgPSBzZWN0aW9ucy5sZW5ndGggPiAwID8gc2VjdGlvbnNbc2VjdGlvbnMubGVuZ3RoIC0gMV1bNF0gOiB0cmVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJlZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21iaW5lcyB0aGUgdmFsdWVzIG9mIGNvbnNlY3V0aXZlIHRleHQgdG9rZW5zIGluIHRoZSBnaXZlbiBgdG9rZW5zYCBhcnJheVxuICAgKiB0byBhIHNpbmdsZSB0b2tlbi5cbiAgICovXG4gIGZ1bmN0aW9uIHNxdWFzaFRva2Vucyh0b2tlbnMpIHtcbiAgICB2YXIgc3F1YXNoZWRUb2tlbnMgPSBbXTtcblxuICAgIHZhciB0b2tlbiwgbGFzdFRva2VuO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0b2tlbnMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuICAgICAgaWYgKHRva2VuWzBdID09PSAndGV4dCcgJiYgbGFzdFRva2VuICYmIGxhc3RUb2tlblswXSA9PT0gJ3RleHQnKSB7XG4gICAgICAgIGxhc3RUb2tlblsxXSArPSB0b2tlblsxXTtcbiAgICAgICAgbGFzdFRva2VuWzNdID0gdG9rZW5bM107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsYXN0VG9rZW4gPSB0b2tlbjtcbiAgICAgICAgc3F1YXNoZWRUb2tlbnMucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNxdWFzaGVkVG9rZW5zO1xuICB9XG5cbiAgZnVuY3Rpb24gZXNjYXBlVGFncyh0YWdzKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIG5ldyBSZWdFeHAoZXNjYXBlUmUodGFnc1swXSkgKyBcIlxcXFxzKlwiKSxcbiAgICAgIG5ldyBSZWdFeHAoXCJcXFxccypcIiArIGVzY2FwZVJlKHRhZ3NbMV0pKVxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICogQnJlYWtzIHVwIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHN0cmluZyBpbnRvIGEgdHJlZSBvZiB0b2tlbiBvYmplY3RzLiBJZlxuICAgKiBgdGFnc2AgaXMgZ2l2ZW4gaGVyZSBpdCBtdXN0IGJlIGFuIGFycmF5IHdpdGggdHdvIHN0cmluZyB2YWx1ZXM6IHRoZVxuICAgKiBvcGVuaW5nIGFuZCBjbG9zaW5nIHRhZ3MgdXNlZCBpbiB0aGUgdGVtcGxhdGUgKGUuZy4gW1wiPCVcIiwgXCIlPlwiXSkuIE9mXG4gICAqIGNvdXJzZSwgdGhlIGRlZmF1bHQgaXMgdG8gdXNlIG11c3RhY2hlcyAoaS5lLiBNdXN0YWNoZS50YWdzKS5cbiAgICovXG4gIGV4cG9ydHMucGFyc2UgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlIHx8ICcnO1xuICAgIHRhZ3MgPSB0YWdzIHx8IGV4cG9ydHMudGFncztcblxuICAgIGlmICh0eXBlb2YgdGFncyA9PT0gJ3N0cmluZycpIHRhZ3MgPSB0YWdzLnNwbGl0KHNwYWNlUmUpO1xuICAgIGlmICh0YWdzLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHRhZ3M6ICcgKyB0YWdzLmpvaW4oJywgJykpO1xuICAgIH1cblxuICAgIHZhciB0YWdSZXMgPSBlc2NhcGVUYWdzKHRhZ3MpO1xuICAgIHZhciBzY2FubmVyID0gbmV3IFNjYW5uZXIodGVtcGxhdGUpO1xuXG4gICAgdmFyIHNlY3Rpb25zID0gW107ICAgICAvLyBTdGFjayB0byBob2xkIHNlY3Rpb24gdG9rZW5zXG4gICAgdmFyIHRva2VucyA9IFtdOyAgICAgICAvLyBCdWZmZXIgdG8gaG9sZCB0aGUgdG9rZW5zXG4gICAgdmFyIHNwYWNlcyA9IFtdOyAgICAgICAvLyBJbmRpY2VzIG9mIHdoaXRlc3BhY2UgdG9rZW5zIG9uIHRoZSBjdXJyZW50IGxpbmVcbiAgICB2YXIgaGFzVGFnID0gZmFsc2U7ICAgIC8vIElzIHRoZXJlIGEge3t0YWd9fSBvbiB0aGUgY3VycmVudCBsaW5lP1xuICAgIHZhciBub25TcGFjZSA9IGZhbHNlOyAgLy8gSXMgdGhlcmUgYSBub24tc3BhY2UgY2hhciBvbiB0aGUgY3VycmVudCBsaW5lP1xuXG4gICAgLy8gU3RyaXBzIGFsbCB3aGl0ZXNwYWNlIHRva2VucyBhcnJheSBmb3IgdGhlIGN1cnJlbnQgbGluZVxuICAgIC8vIGlmIHRoZXJlIHdhcyBhIHt7I3RhZ319IG9uIGl0IGFuZCBvdGhlcndpc2Ugb25seSBzcGFjZS5cbiAgICBmdW5jdGlvbiBzdHJpcFNwYWNlKCkge1xuICAgICAgaWYgKGhhc1RhZyAmJiAhbm9uU3BhY2UpIHtcbiAgICAgICAgd2hpbGUgKHNwYWNlcy5sZW5ndGgpIHtcbiAgICAgICAgICB0b2tlbnMuc3BsaWNlKHNwYWNlcy5wb3AoKSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwYWNlcyA9IFtdO1xuICAgICAgfVxuXG4gICAgICBoYXNUYWcgPSBmYWxzZTtcbiAgICAgIG5vblNwYWNlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHN0YXJ0LCB0eXBlLCB2YWx1ZSwgY2hyO1xuICAgIHdoaWxlICghc2Nhbm5lci5lb3MoKSkge1xuICAgICAgc3RhcnQgPSBzY2FubmVyLnBvcztcbiAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwodGFnUmVzWzBdKTtcblxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgIGNociA9IHZhbHVlLmNoYXJBdChpKTtcblxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoY2hyKSkge1xuICAgICAgICAgICAgc3BhY2VzLnB1c2godG9rZW5zLmxlbmd0aCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0b2tlbnMucHVzaChbXCJ0ZXh0XCIsIGNociwgc3RhcnQsIHN0YXJ0ICsgMV0pO1xuICAgICAgICAgIHN0YXJ0ICs9IDE7XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBcIlxcblwiKSB7XG4gICAgICAgICAgICBzdHJpcFNwYWNlKCk7IC8vIENoZWNrIGZvciB3aGl0ZXNwYWNlIG9uIHRoZSBjdXJyZW50IGxpbmUuXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHN0YXJ0ID0gc2Nhbm5lci5wb3M7XG5cbiAgICAgIC8vIE1hdGNoIHRoZSBvcGVuaW5nIHRhZy5cbiAgICAgIGlmICghc2Nhbm5lci5zY2FuKHRhZ1Jlc1swXSkpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGhhc1RhZyA9IHRydWU7XG4gICAgICB0eXBlID0gc2Nhbm5lci5zY2FuKHRhZ1JlKSB8fCBcIm5hbWVcIjtcblxuICAgICAgLy8gU2tpcCBhbnkgd2hpdGVzcGFjZSBiZXR3ZWVuIHRhZyBhbmQgdmFsdWUuXG4gICAgICBzY2FubmVyLnNjYW4od2hpdGVSZSk7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIHRhZyB2YWx1ZS5cbiAgICAgIGlmICh0eXBlID09PSBcIj1cIikge1xuICAgICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKGVxUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oZXFSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhblVudGlsKHRhZ1Jlc1sxXSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwie1wiKSB7XG4gICAgICAgIHZhciBjbG9zZVJlID0gbmV3IFJlZ0V4cChcIlxcXFxzKlwiICsgZXNjYXBlUmUoXCJ9XCIgKyB0YWdzWzFdKSk7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2VSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihjdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwodGFnUmVzWzFdKTtcbiAgICAgICAgdHlwZSA9IFwiJlwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbCh0YWdSZXNbMV0pO1xuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgY2xvc2luZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2Nhbih0YWdSZXNbMV0pKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgdGFnIGF0ICcgKyBzY2FubmVyLnBvcyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIHNlY3Rpb24gbmVzdGluZy5cbiAgICAgIGlmICh0eXBlID09PSAnLycpIHtcbiAgICAgICAgaWYgKHNlY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5vcGVuZWQgc2VjdGlvbiBcIicgKyB2YWx1ZSArICdcIiBhdCAnICsgc3RhcnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcblxuICAgICAgICBpZiAoc2VjdGlvblsxXSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgc2VjdGlvblsxXSArICdcIiBhdCAnICsgc3RhcnQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciB0b2tlbiA9IFt0eXBlLCB2YWx1ZSwgc3RhcnQsIHNjYW5uZXIucG9zXTtcbiAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgaWYgKHR5cGUgPT09ICcjJyB8fCB0eXBlID09PSAnXicpIHtcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwibmFtZVwiIHx8IHR5cGUgPT09IFwie1wiIHx8IHR5cGUgPT09IFwiJlwiKSB7XG4gICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCI9XCIpIHtcbiAgICAgICAgLy8gU2V0IHRoZSB0YWdzIGZvciB0aGUgbmV4dCB0aW1lIGFyb3VuZC5cbiAgICAgICAgdGFncyA9IHZhbHVlLnNwbGl0KHNwYWNlUmUpO1xuXG4gICAgICAgIGlmICh0YWdzLmxlbmd0aCAhPT0gMikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWdzIGF0ICcgKyBzdGFydCArICc6ICcgKyB0YWdzLmpvaW4oJywgJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFnUmVzID0gZXNjYXBlVGFncyh0YWdzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhlcmUgYXJlIG5vIG9wZW4gc2VjdGlvbnMgd2hlbiB3ZSdyZSBkb25lLlxuICAgIHZhciBzZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG4gICAgaWYgKHNlY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgc2VjdGlvbiBcIicgKyBzZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzY2FubmVyLnBvcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5lc3RUb2tlbnMoc3F1YXNoVG9rZW5zKHRva2VucykpO1xuICB9O1xuXG4gIC8vIFRoZSBoaWdoLWxldmVsIGNsZWFyQ2FjaGUsIGNvbXBpbGUsIGNvbXBpbGVQYXJ0aWFsLCBhbmQgcmVuZGVyIGZ1bmN0aW9uc1xuICAvLyB1c2UgdGhpcyBkZWZhdWx0IHdyaXRlci5cbiAgdmFyIF93cml0ZXIgPSBuZXcgV3JpdGVyKCk7XG5cbiAgLyoqXG4gICAqIENsZWFycyBhbGwgY2FjaGVkIHRlbXBsYXRlcyBhbmQgcGFydGlhbHMgaW4gdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgZXhwb3J0cy5jbGVhckNhY2hlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfd3JpdGVyLmNsZWFyQ2FjaGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGlsZXMgdGhlIGdpdmVuIGB0ZW1wbGF0ZWAgdG8gYSByZXVzYWJsZSBmdW5jdGlvbiB1c2luZyB0aGUgZGVmYXVsdFxuICAgKiB3cml0ZXIuXG4gICAqL1xuICBleHBvcnRzLmNvbXBpbGUgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICByZXR1cm4gX3dyaXRlci5jb21waWxlKHRlbXBsYXRlLCB0YWdzKTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGlsZXMgdGhlIHBhcnRpYWwgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVgIGFuZCBgdGVtcGxhdGVgIHRvIGEgcmV1c2FibGVcbiAgICogZnVuY3Rpb24gdXNpbmcgdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgZXhwb3J0cy5jb21waWxlUGFydGlhbCA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZSwgdGFncykge1xuICAgIHJldHVybiBfd3JpdGVyLmNvbXBpbGVQYXJ0aWFsKG5hbWUsIHRlbXBsYXRlLCB0YWdzKTtcbiAgfTtcblxuICAvKipcbiAgICogQ29tcGlsZXMgdGhlIGdpdmVuIGFycmF5IG9mIHRva2VucyAodGhlIG91dHB1dCBvZiBhIHBhcnNlKSB0byBhIHJldXNhYmxlXG4gICAqIGZ1bmN0aW9uIHVzaW5nIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIGV4cG9ydHMuY29tcGlsZVRva2VucyA9IGZ1bmN0aW9uICh0b2tlbnMsIHRlbXBsYXRlKSB7XG4gICAgcmV0dXJuIF93cml0ZXIuY29tcGlsZVRva2Vucyh0b2tlbnMsIHRlbXBsYXRlKTtcbiAgfTtcblxuICAvKipcbiAgICogUmVuZGVycyB0aGUgYHRlbXBsYXRlYCB3aXRoIHRoZSBnaXZlbiBgdmlld2AgYW5kIGBwYXJ0aWFsc2AgdXNpbmcgdGhlXG4gICAqIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgZXhwb3J0cy5yZW5kZXIgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgcmV0dXJuIF93cml0ZXIucmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyk7XG4gIH07XG5cbiAgLy8gVGhpcyBpcyBoZXJlIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIDAuNC54LlxuICBleHBvcnRzLnRvX2h0bWwgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzLCBzZW5kKSB7XG4gICAgdmFyIHJlc3VsdCA9IGV4cG9ydHMucmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyk7XG5cbiAgICBpZiAodHlwZW9mIHNlbmQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgc2VuZChyZXN1bHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gZXhwb3J0cztcblxufSgpKSkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHRoaXMuZGVmYXVsdEVxdWFscyA9IHRydWU7IC8vIElmIHdlIGNhbid0IGZpbmQgYSB2YWxpZCBoYW5kbGVyIGRlZmF1bHQgdG8ga2V5PT12YWwgYmVoYXZpb3VyIChpLmUuIHsnZm9vJzogJ2Jhcid9IHRlc3RzIHRoYXQgdGhlIGtleSAnZm9vJyBpcyB0aGUgdmFsdWUgJ2JhcicpXG5cdHRoaXMuc2lsZW50ID0gZmFsc2U7IC8vIFNodXQgdXAgaWYgd2UgY2FudCBmaW5kIGEgc3VpdGFibGUgaGFuZGxlclxuXG5cdHRoaXMuaGFuZGxlcnMgPSBbXTtcblxuXHR0aGlzLm15RmlsdGVyID0gbnVsbDtcblx0dGhpcy5teURhdGEgPSBudWxsO1xuXHR0aGlzLm15TGltaXQgPSBudWxsO1xuXHR0aGlzLm15V2FudEFycmF5ID0gZmFsc2U7XG5cblx0dGhpcy5pbml0ID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgPXsxLDJ9JC8sIGZ1bmN0aW9uKGtleSwgdmFsLCBkYXRhKSB7IC8vIHsnZm9vID0nOiAnYmFyJ30gb3Igeydmb28gPT0nOiAnYmFyJ31cblx0XHRcdHJldHVybiAoZGF0YVtrZXldID09IHZhbCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgPiQvLCBmdW5jdGlvbihrZXksIHZhbCwgZGF0YSkgeyAvLyB7J2ZvbyA+JzogJ2Jhcid9XG5cdFx0XHRyZXR1cm4gKGRhdGFba2V5XSA+IHZhbCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgPCQvLCBmdW5jdGlvbihrZXksIHZhbCwgZGF0YSkgeyAvLyB7J2ZvbyA8JzogJ2Jhcid9XG5cdFx0XHRyZXR1cm4gKGRhdGFba2V5XSA8IHZhbCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgKD86Pj18PT4pJC8sIGZ1bmN0aW9uKGtleSwgdmFsLCBkYXRhKSB7IC8vIHsnZm9vID49JzogJ2Jhcid9IChvciAnPT4nKVxuXHRcdFx0cmV0dXJuIChkYXRhW2tleV0gPj0gdmFsKTtcblx0XHR9KTtcblx0XHR0aGlzLmFkZEhhbmRsZXIoL14oLio/KSAoPzo8PXw9PCkkLywgZnVuY3Rpb24oa2V5LCB2YWwsIGRhdGEpIHsgLy8geydmb28gPD0nOiAnYmFyJ30gb3IgKCc9PCcpXG5cdFx0XHRyZXR1cm4gKGRhdGFba2V5XSA8PSB2YWwpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdC8vIFNpbXBsZSBzZXR0ZXJzIHt7e1xuXHR0aGlzLmZpbHRlciA9IGZ1bmN0aW9uKGZpbHRlcikge1xuXHRcdHRoaXMubXlGaWx0ZXIgPSBmaWx0ZXI7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dGhpcy5kYXRhID0gZnVuY3Rpb24oZGF0YSkge1xuXHRcdHRoaXMubXlEYXRhID0gZGF0YTtcblx0XHRyZXR1cm4gdGhpcztcblx0fTtcblxuXHR0aGlzLmxpbWl0ID0gZnVuY3Rpb24obGltaXQpIHtcblx0XHR0aGlzLm15TGltaXQgPSBsaW1pdDtcblx0XHRyZXR1cm4gdGhpcztcblx0fTtcblxuXHR0aGlzLndhbnRBcnJheSA9IGZ1bmN0aW9uKHdhbnRBcnJheSkge1xuXHRcdHRoaXMubXlXYW50QXJyYXkgPSB3YW50QXJyYXkgPT09IHVuZGVmaW5lZCA/IHRydWUgOiB3YW50QXJyYXk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cdC8vIH19fVxuXG5cdHRoaXMucmVzZXQgPSBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm15RGF0YSA9IG51bGw7XG5cdFx0dGhpcy5teUZpbHRlciA9IG51bGw7XG5cdFx0dGhpcy5teVdhbnRBcnJheSA9IGZhbHNlO1xuXHRcdHRoaXMubXlMaW1pdCA9IDA7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dGhpcy5hZGRIYW5kbGVyID0gZnVuY3Rpb24ocmUsIGNhbGxiYWNrKSB7XG5cdFx0dGhpcy5oYW5kbGVycy5wdXNoKFtyZSwgY2FsbGJhY2tdKTtcblx0fTtcblxuXHR0aGlzLmV4ZWMgPSBmdW5jdGlvbihmaWx0ZXIsIGRhdGEsIGxpbWl0KSB7XG5cdFx0dmFyIG91dCA9IHRoaXMubXlXYW50QXJyYXkgPyBbXSA6IHt9O1xuXHRcdHZhciBmb3VuZCA9IDA7XG5cdFx0aWYgKCFmaWx0ZXIpXG5cdFx0XHRmaWx0ZXIgPSB0aGlzLm15RmlsdGVyO1xuXHRcdGlmICghZGF0YSlcblx0XHRcdGRhdGEgPSB0aGlzLm15RGF0YTtcblx0XHRpZiAoIWxpbWl0KVxuXHRcdFx0bGltaXQgPSB0aGlzLm15TGltaXQ7XG5cblx0XHRmb3IgKHZhciBpZCBpbiBkYXRhKSB7XG5cdFx0XHR2YXIgcm93ID0gZGF0YVtpZF07XG5cdFx0XHRpZiAodGhpcy5tYXRjaGVzKGZpbHRlciwgcm93KSkge1xuXHRcdFx0XHRpZiAodGhpcy5teVdhbnRBcnJheSkge1xuXHRcdFx0XHRcdG91dC5wdXNoKHJvdyk7XG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdG91dFtpZF0gPSByb3c7XG5cblx0XHRcdFx0aWYgKGxpbWl0ICYmICsrZm91bmQgPj0gbGltaXQpXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXQ7XG5cdH07XG5cblx0dGhpcy5tYXRjaGVzID0gZnVuY3Rpb24oZmlsdGVyLCBkYXRhKSB7XG5cdFx0Zm9yICh2YXIga2V5IGluIGZpbHRlcikge1xuXHRcdFx0dmFyIGhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdGZvciAodmFyIGggaW4gdGhpcy5oYW5kbGVycykge1xuXHRcdFx0XHR2YXIgbWF0Y2hlcztcblx0XHRcdFx0aWYgKG1hdGNoZXMgPSB0aGlzLmhhbmRsZXJzW2hdWzBdLmV4ZWMoa2V5KSkgeyAvLyBVc2UgdGhpcyBoYW5kbGVyXG5cdFx0XHRcdFx0aGFuZGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0aWYgKHRoaXMuaGFuZGxlcnNbaF1bMV0obWF0Y2hlc1sxXSwgZmlsdGVyW2tleV0sIGRhdGEpKSB7XG5cdFx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZygnT0snKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFoYW5kbGVkKVxuXHRcdFx0XHRpZiAodGhpcy5kZWZhdWx0RXF1YWxzKSB7XG5cdFx0XHRcdFx0aWYgKGRhdGFba2V5XSAhPSBmaWx0ZXJba2V5XSlcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuc2lsZW50KVxuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBmaWx0ZXIgbWF0Y2hpbmcgaW5jb21taW5nIHN0cmluZyBcIicgKyBrZXkgKyAnXCIuIERlZmF1bHRpbmcgdG8gbm8tbWF0Y2gnKTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH07XG5cblx0dGhpcy5pbml0KCk7XG59XG4iLCJ2YXIgZ2xvYmFsPXNlbGY7LyoqXG4qIEJhdHRcbiogRm9ybSBhbmQgZGF0YSBtYW5pcHVsYXRpb24gbGlicmFyeVxuKlxuKiBAdXJsIGh0dHBzOi8vZ2l0aHViLmNvbS9Nb21zRnJpZW5kbHlEZXZDby9CYXR0XG4qIEBhdXRob3IgTWF0dCBDYXJ0ZXIgPG1AdHRjYXJ0ZXIuY29tPlxuKiBAbGljZW5zZSBDQy1BdHRyaWJ1dGlvbi1Ob25Db21tZXJjaWFsLU5vRGVyaXZzIDMuMCBVbnBvcnRlZFxuKiBAbGljZW5zZVVSTCBodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9saWNlbnNlcy9ieS1uYy1uZC8zLjAvXG4qL1xuXG4vLyBSRVFVSVJFIC0gQmF0dCBvYmplY3RzIHt7e1xudmFyIGJhdHRfb2JqZWN0ID0gcmVxdWlyZSgnLi9iYXR0X29iamVjdC5qcycpO1xuXG52YXIgYmF0dF9jaGVja2JveCA9IHJlcXVpcmUoJy4vYmF0dF9jaGVja2JveC5qcycpO1xuYmF0dF9jaGVja2JveC5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2RhdGUgPSByZXF1aXJlKCcuL2JhdHRfZGF0ZS5qcycpO1xuYmF0dF9kYXRlLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xudmFyIGJhdHRfY2hvaWNlID0gcmVxdWlyZSgnLi9iYXR0X2Nob2ljZS5qcycpO1xuYmF0dF9jaG9pY2UucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9jaG9pY2VfcmFkaW8gPSByZXF1aXJlKCcuL2JhdHRfY2hvaWNlX3JhZGlvLmpzJyk7XG5iYXR0X2Nob2ljZV9yYWRpby5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2NvbnRhaW5lciA9IHJlcXVpcmUoJy4vYmF0dF9jb250YWluZXIuanMnKTtcbmJhdHRfY29udGFpbmVyLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xudmFyIGJhdHRfY29udGFpbmVyX3NwbGl0dGVyID0gcmVxdWlyZSgnLi9iYXR0X2NvbnRhaW5lcl9zcGxpdHRlci5qcycpO1xuYmF0dF9jb250YWluZXJfc3BsaXR0ZXIucHJvdG90eXBlID0gbmV3IGJhdHRfY29udGFpbmVyKCk7XG5cbnZhciBiYXR0X2ZlZWQgPSByZXF1aXJlKCcuL2JhdHRfZmVlZC5qcycpO1xuYmF0dF9mZWVkLnByb3RvdHlwZSA9IG5ldyBiYXR0X2NvbnRhaW5lcigpO1xudmFyIGJhdHRfZmVlZF9iYXR0ID0gcmVxdWlyZSgnLi9iYXR0X2ZlZWRfYmF0dC5qcycpO1xuYmF0dF9mZWVkX2JhdHQucHJvdG90eXBlID0gbmV3IGJhdHRfZmVlZCgpO1xuXG52YXIgYmF0dF9kcm9wZG93biA9IHJlcXVpcmUoJy4vYmF0dF9kcm9wZG93bi5qcycpO1xuYmF0dF9kcm9wZG93bi5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcbnZhciBiYXR0X2Zvcm0gPSByZXF1aXJlKCcuL2JhdHRfZm9ybS5qcycpO1xuYmF0dF9mb3JtLnByb3RvdHlwZSA9IG5ldyBiYXR0X2NvbnRhaW5lcigpO1xudmFyIGJhdHRfcmVmZXJlbmNlID0gcmVxdWlyZSgnLi9iYXR0X3JlZmVyZW5jZS5qcycpO1xuYmF0dF9yZWZlcmVuY2UucHJvdG90eXBlID0gbmV3IGJhdHRfY29udGFpbmVyKCk7XG52YXIgYmF0dF90YWJsZSA9IHJlcXVpcmUoJy4vYmF0dF90YWJsZS5qcycpO1xuYmF0dF90YWJsZS5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcbnZhciBiYXR0X3RhYnMgPSByZXF1aXJlKCcuL2JhdHRfdGFicy5qcycpO1xuYmF0dF90YWJzLnByb3RvdHlwZSA9IG5ldyBiYXR0X2NvbnRhaW5lcigpO1xuXG52YXIgYmF0dF9pbnB1dCA9IHJlcXVpcmUoJy4vYmF0dF9pbnB1dC5qcycpO1xuYmF0dF9pbnB1dC5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2xhYmVsID0gcmVxdWlyZSgnLi9iYXR0X2xhYmVsLmpzJyk7XG5iYXR0X2xhYmVsLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xudmFyIGJhdHRfc3RyaW5nID0gcmVxdWlyZSgnLi9iYXR0X3N0cmluZy5qcycpO1xuYmF0dF9zdHJpbmcucHJvdG90eXBlID0gbmV3IGJhdHRfaW5wdXQoKTtcbnZhciBiYXR0X251bWJlciA9IHJlcXVpcmUoJy4vYmF0dF9udW1iZXIuanMnKTtcbmJhdHRfbnVtYmVyLnByb3RvdHlwZSA9IG5ldyBiYXR0X2lucHV0KCk7XG52YXIgYmF0dF90ZXh0ID0gcmVxdWlyZSgnLi9iYXR0X3RleHQuanMnKTtcbmJhdHRfdGV4dC5wcm90b3R5cGUgPSBuZXcgYmF0dF9pbnB1dCgpO1xuXG52YXIgYmF0dF9maWxlID0gcmVxdWlyZSgnLi9iYXR0X2ZpbGUuanMnKTtcbmJhdHRfZmlsZS5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2hlYWRpbmcgPSByZXF1aXJlKCcuL2JhdHRfaGVhZGluZy5qcycpO1xuYmF0dF9oZWFkaW5nLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xudmFyIGJhdHRfaHRtbCA9IHJlcXVpcmUoJy4vYmF0dF9odG1sLmpzJyk7XG5iYXR0X2h0bWwucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG5cbnZhciBiYXR0X2xpbmsgPSByZXF1aXJlKCcuL2JhdHRfbGluay5qcycpO1xuYmF0dF9saW5rLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xudmFyIGJhdHRfYnV0dG9uID0gcmVxdWlyZSgnLi9iYXR0X2J1dHRvbi5qcycpO1xuYmF0dF9idXR0b24ucHJvdG90eXBlID0gbmV3IGJhdHRfbGluaygpO1xudmFyIGJhdHRfdGFnID0gcmVxdWlyZSgnLi9iYXR0X3RhZy5qcycpO1xuYmF0dF90YWcucHJvdG90eXBlID0gbmV3IGJhdHRfbGluaygpO1xuXG52YXIgYmF0dF91bmtub3duID0gcmVxdWlyZSgnLi9iYXR0X3Vua25vd24uanMnKTtcbmJhdHRfdW5rbm93bi5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbi8vIH19fVxuLy8gUkVRVUlSRSAtIFRoaXJkIHBhcnR5IG1vZHVsZXMge3t7XG52YXIgTXVzdGFjaGUgPSByZXF1aXJlKCdtdXN0YWNoZScpO1xuLy8gfX19XG5cbmdsb2JhbC5iYXR0ID0ge1xuXHRkZWJ1ZzogdHJ1ZSwgLy8gVGhpcyBpcyBjaGFuZ2VkIGR1cmluZyBzY3JpcHQgY29tcGlsZSB0byBGQUxTRVxuXHRmb3Jtczoge30sXG5cdHVzZXNQYXRoOiAnJywgLy8gQXNzdW1lIGN1cnJlbnQgZGlyZWN0b3J5IGlzIHdoZXJlIHdlIGZpbmQgJ3VzZXMnIG1vZHVsZXNcblx0aXNSZWFkeTogZmFsc2UsXG5cdHNldHM6IFtdLFxuXHRzdG9wOiBmYWxzZSxcblxuXHRmZWVkczoge30sXG5cblx0d2lkZ2V0czoge1xuXHRcdGJ1dHRvbjoge2luaGVyaXRzOiAnbGluaycsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2J1dHRvbi5qcycpfSxcblx0XHRjaGVja2JveDoge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfY2hlY2tib3guanMnKX0sXG5cdFx0Y2hvaWNlOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jaG9pY2UuanMnKX0sXG5cdFx0Y2hvaWNlX3JhZGlvOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jaG9pY2VfcmFkaW8uanMnKX0sXG5cdFx0Y29udGFpbmVyOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jb250YWluZXIuanMnKX0sXG5cdFx0Y29udGFpbmVyX3NwbGl0dGVyOiB7aW5oZXJpdHM6ICdjb250YWluZXInLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9jb250YWluZXJfc3BsaXR0ZXIuanMnKX0sXG5cdFx0ZGF0ZToge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZGF0ZS5qcycpfSxcblx0XHRkcm9wZG93bjoge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZHJvcGRvd24uanMnKX0sXG5cdFx0ZW1haWw6IHtpbmhlcml0czogJ2lucHV0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZW1haWwuanMnKX0sXG5cdFx0ZmVlZF9iYXR0OiB7aW5oZXJpdHM6ICdmZWVkJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZmVlZF9iYXR0LmpzJyl9LFxuXHRcdGZlZWQ6IHtpbmhlcml0czogJ2NvbnRhaW5lcicsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2ZlZWQuanMnKX0sXG5cdFx0ZmlsZToge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZmlsZS5qcycpfSxcblx0XHRmb3JtOiB7aW5oZXJpdHM6ICdjb250YWluZXInLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9mb3JtLmpzJyl9LFxuXHRcdGhlYWRpbmc6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2hlYWRpbmcuanMnKX0sXG5cdFx0aHRtbDoge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfaHRtbC5qcycpfSxcblx0XHRpbnB1dDoge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfaW5wdXQuanMnKX0sXG5cdFx0bGFiZWw6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2xhYmVsLmpzJyl9LFxuXHRcdGxpbms6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2xpbmsuanMnKX0sXG5cdFx0bnVtYmVyOiB7aW5oZXJpdHM6ICdpbnB1dCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X251bWJlci5qcycpfSxcblx0XHRvYmplY3Q6IHtvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9vYmplY3QuanMnKX0sXG5cdFx0cmVmZXJlbmNlOiB7aW5oZXJpdHM6ICdjb250YWluZXInLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9yZWZlcmVuY2UuanMnKX0sXG5cdFx0c3RyaW5nOiB7aW5oZXJpdHM6ICdpbnB1dCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X3N0cmluZy5qcycpfSxcblx0XHR0YWJsZToge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfdGFibGUuanMnKX0sXG5cdFx0dGFiczoge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfdGFicy5qcycpfSxcblx0XHR0YWc6IHtpbmhlcml0czogJ2xpbmsnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF90YWcuanMnKX0sXG5cdFx0dGV4dDoge2luaGVyaXRzOiAnaW5wdXQnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF90ZXh0LmpzJyl9LFxuXHRcdHVua25vd246IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X3Vua25vd24uanMnKX1cblx0fSxcblxuXHQvKipcblx0KiBWYXJpYWJsZXMgYXZhaWxhYmxlIHRvIG9iamVjdC5wYXJzZSgpXG5cdCogQHZhciBoYXNoXG5cdCovXG5cdHBhcnNlR2xvYmFsczoge1xuXHRcdC8qKlxuXHRcdCogRXh0cmFjdHMgYSBVUkwgc2VnbWVudCB1c2luZyBhIG1hbmdsZWQgdmVyc2lvbiBvZiBhIGdsb2Jcblx0XHQqIFxuXHRcdCogVG9rZW5zOlxuXHRcdCpcdC0gJyonIC0gTWF0Y2ggYW55IG51bWJlciBvZiBjaGFyYWN0ZXJzXG5cdFx0Klx0LSAnPycgLSBNYXRjaCBvbmUgY2hyYWN0ZXJcblx0XHQqXHQtICchJyAtIENhcHR1cmUgdGhpc1xuXHRcdCpcblx0XHQqIEV4YW1wbGVzOlxuXHRcdCpcdC0ge3sjdXJsfX0vdXNlcnMvIXt7L3VybH19XG5cdFx0Klx0LSB7eyN1cmx9fS9wYXRoL3RvL2Rpci8he3svdXJsfX1cblx0XHQqXHQtIHt7I3VybH19L3VzZXJzL3R5cGUvKiAvdXNlcmlkIXt7L3VybH19IChzcGFjZSBhZGRlZCBhZnRlciAnKicgc28gbm90IHRvIHVwc2V0IHN5bnRheCBwYXJzZXJzIHRoYXQgc2VlIGl0IGFzIGVuZC1vZi1jb21tZW50cylcblx0XHQqL1xuXHRcdHVybDogZnVuY3Rpb24odGV4dCwgcmVuZGVyKSB7IC8vIFVybCBleHRyYWN0b3IgZnVuY3Rpb24gLSBlLmcuIFxuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKHRleHQsIHJlbmRlcikge1xuXHRcdFx0XHR2YXIgcmVTdHIgPSB0ZXh0XG5cdFx0XHRcdFx0LnJlcGxhY2UoJyonLCAnPEZJTFRFUjpBTlk+Jylcblx0XHRcdFx0XHQucmVwbGFjZSgnPycsICc8RklMVEVSOk9ORT4nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCchJywgJzxGSUxURVI6Q0FQVFVSRT4nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKC8oWy4/KiteJFtcXF1cXC9cXFxcKCl7fXwtXSkvZywgXCJcXFxcJDFcIilcblx0XHRcdFx0XHQucmVwbGFjZSgnPEZJTFRFUjpBTlk+JywgJy4qJylcblx0XHRcdFx0XHQucmVwbGFjZSgnPEZJTFRFUjpPTkU+JywgJy4nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCc8RklMVEVSOkNBUFRVUkU+JywgJyguKiknKTtcblx0XHRcdFx0dmFyIHJlID0gbmV3IFJlZ0V4cChyZVN0cik7XG5cdFx0XHRcdHZhciBmb3VuZCA9IHJlLmV4ZWMoZG9jdW1lbnQubG9jYXRpb24ucGF0aG5hbWUpO1xuXHRcdFx0XHR2YXIgYml0ID0gZm91bmRbMV0gfHwgJyc7XG5cdFx0XHRcdHJldHVybiBiaXQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdHJlYWR5OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmlzUmVhZHkgPSB0cnVlO1xuXG5cdFx0JC5lYWNoKHRoaXMuc2V0cywgZnVuY3Rpb24oaSwgc2V0KSB7XG5cdFx0XHRjb25zb2xlLmxvZygnVHJpZ2dlciBsb2FkIG9mJywgc2V0KTtcblx0XHRcdGlmIChzZXQuZWxlbWVudCkgeyAvLyBMb2FkIGludG8gZWxlbWVudCBpLmUuIGludm9rZSAkKGVsZW1lbnQpLmJhdHQoY29udGVudClcblx0XHRcdFx0c2V0LmVsZW1lbnQuYmF0dChzZXQuY29udGVudCk7XG5cdFx0XHR9IGVsc2UgLy8gTm8gZWxlbWVudCAtIHByb2JhYmx5IGFuIGFub255bW91cyBsb2FkIChpLmUuIGJhdHQuc2V0KGNvbnRlbnQpKVxuXHRcdFx0XHRiYXR0LnNldChzZXQuY29udGVudCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLnNldHMgPSBbXTtcblx0fSxcblxuXHRtYWtlT2JqZWN0OiBmdW5jdGlvbih0eXBlKSB7XG5cdFx0dmFyIG9iajtcblx0XHR0eXBlID0gdHlwZS5yZXBsYWNlKCctJywgJ18nKTtcblx0XHRpZiAoIWJhdHQud2lkZ2V0c1t0eXBlXSkge1xuXHRcdFx0b2JqID0gYmF0dC5tYWtlT2JqZWN0KCd1bmtub3duJyk7XG5cdFx0XHRvYmoudHlwZUZhaWxlZCA9IHR5cGU7XG5cdFx0XHRyZXR1cm4gb2JqO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoYmF0dC53aWRnZXRzW3R5cGVdLmluaGVyaXRzKVxuXHRcdFx0XHRiYXR0LndpZGdldHNbdHlwZV0ub2JqZWN0LnByb3RvdHlwZSA9IG5ldyBiYXR0LndpZGdldHNbYmF0dC53aWRnZXRzW3R5cGVdLmluaGVyaXRzXS5vYmplY3QoKTtcblx0XHRcdG9iaiA9IG5ldyBiYXR0LndpZGdldHNbdHlwZV0ub2JqZWN0KCk7XG5cdFx0fVxuXHRcdG9iai50eXBlID0gdHlwZTtcblx0XHRpZiAoYmF0dC53aWRnZXRzW3R5cGVdLmluaGVyaXRzKSB7IC8vIEdsdWUgcHJvdG90eXBlIGFjY2Vzc29yIHRvIC5zdXBlclxuXHRcdFx0dmFyIHByb3RvID0gbmV3IGJhdHQud2lkZ2V0c1tiYXR0LndpZGdldHNbdHlwZV0uaW5oZXJpdHNdLm9iamVjdCgpO1xuXHRcdFx0b2JqLnN1cGVyID0gcHJvdG87XG5cdFx0fVxuXHRcdHJldHVybiBvYmo7XG5cdH0sXG5cblx0LyoqXG5cdCogTG9hZCBhIEJhdHQgcGx1Z2luIGZyb20gcGx1Z2lucy8kbmFtZS5qc1xuXHQqIFRoaXMgaXMgcmVhbGx5IGp1c3QgYSBkdW1iIHdyYXBwZXIgZm9yICRzY3JpcHQoKVxuXHQqIEBwYXJhbSBzdHJpbmd8YXJyYXkgbmFtZSBFaXRoZXIgYSBzaW5nbGUgcGx1Z2luIHRvIGxvYWQgb3IgYW4gYXJyYXkgb2YgcGx1Z2lucyB0byBsb2FkXG5cdCovXG5cdHBsdWdpbjogZnVuY3Rpb24obmFtZSkge1xuXHRcdGlmICh0eXBlb2YgbmFtZSA9PSAnYXJyYXknKSB7IC8vIEdpdmVuIGFuIGFycmF5IC0gb3ZlcmxvYWQgdG8gaW5kaXZpZHVhbCBjYWxsc1xuXHRcdFx0Zm9yICh2YXIgcCBpbiBuYW1lKVxuXHRcdFx0XHRiYXR0LnBsdWdpbihuYW1lW3BdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5sb2coJ0JhdHQ+IExvYWRpbmcgcGx1Z2luICcsIG5hbWUpO1xuXHRcdFx0JHNjcmlwdChiYXR0LnBhdGggKyAnL3BsdWdpbnMvJyArIG5hbWUgKyAnLmpzJyk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQqIExvYWQgZ2VuZXJpYyBCYXR0IHNwZWMgaW50byBhbiBhbm9ueW1vdXMgb2JqZWN0XG5cdCogVGhpcyB3aWxsIG5ldmVyIGFjdHVhbGx5IGFwcGVhci4gSXRzIG1vc3RseSB1c2VkIHRvIGxvYWQgZGItdGFibGUgd2lkZ2V0cyBldGNcblx0KiBAcGFyYW0gc3RyaW5nIGpzb24gVGhlIEJhdHQgb2JqZWN0IHNwZWMgdG8gbG9hZFxuXHQqL1xuXHRzZXQ6IGZ1bmN0aW9uKGpzb24pIHtcblx0XHR2YXIgaWQgPSBiYXR0LmdldFVuaXF1ZUlkKCdiYXR0LWZvcm0tJyk7XG5cdFx0aWYgKGJhdHQuaXNSZWFkeSkge1xuXHRcdFx0YmF0dC5mb3Jtc1tpZF0gPSBuZXcgYmF0dF9mb3JtKCk7XG5cdFx0XHRiYXR0LmZvcm1zW2lkXS50eXBlID0gJ2Zvcm0nO1xuXHRcdFx0YmF0dC5mb3Jtc1tpZF0uc2V0KGpzb24pO1xuXHRcdH0gZWxzZSB7IC8vIE5vdCB5ZXQgcmVhZHlcblx0XHRcdGNvbnNvbGUubG9nKCdCYXR0IG5vdCB5ZXQgcmVhZHkuIERlZmVyZWQgbG9hZCBmb3IgYW5vbnltb3VzIG9iamVjdCcsIGlkKTtcblx0XHRcdGJhdHQuc2V0cy5wdXNoKHtcblx0XHRcdFx0Y29udGVudDoganNvblxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9LFxuXG5cdGZpbmQ6IGZ1bmN0aW9uKGlkKSB7XG5cdFx0aWYgKGJhdHQuZm9ybXNbaWRdKSAvLyBJcyB0aGUgSUQgYW4gYWN0dWFsIGZvcm0/XG5cdFx0XHRyZXR1cm4gYmF0dC5mb3Jtc1tpZF07XG5cblx0XHRmb3IgKHZhciBmIGluIGJhdHQuZm9ybXMpIHsgLy8gTm9wZS4gUmVjdXJzZSBpbnRvIGVhY2ggZm9ybVxuXHRcdFx0dmFyIGZvdW5kID0gYmF0dC5mb3Jtc1tmXS5maW5kKGlkKTtcblx0XHRcdGlmIChmb3VuZClcblx0XHRcdFx0cmV0dXJuIGZvdW5kO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fSxcblxuXHQvKipcblx0KiBTaW1wbGUgd3JhcHBlciB0byBydW4gYSBmdW5jdGlvbiBvbiBBTEwgYmF0dCBvYmplY3RzXG5cdCogVGhpcyBpcyByZWFsbHkganVzdCBhIGR1bWIgd3JhcHBlciBmb3IgcnVubmluZyAuZWFjaENoaWxkIG9uIGFsbCBpdGVtcyBpbiB0aGUgYmF0dC5mb3JtcyBoYXNoXG5cdCogQHBhcmFtIGNhbGxiYWNrIGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBydW4uIENhbGxlZCBpbiB0aGUgZm9ybWF0IGZ1bmN0aW9uKCkge30gc2V0dGluZyAndGhpcycgdG8gdGhlIGN1cnJlbnQgY29udGV4dFxuXHQqIEBwYXJhbSBoYXNoIG9wdGlvbnMgQSBoYXNoIG9mIG9wdGlvbnMgdG8gdXNlIHdoZW4gZmlsdGVyaW5nXG5cdCogQHNlZSBiYXR0X2NvbnRhaW5lci9lYWNoQ2hpbGQoKVxuXHQqL1xuXHRlYWNoQ2hpbGQ6IGZ1bmN0aW9uKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0Zm9yICh2YXIgZiBpbiBiYXR0LmZvcm1zKSB7XG5cdFx0XHRpZiAoYmF0dC5mb3Jtc1tmXS5lYWNoQ2hpbGQoY2FsbGJhY2ssIG9wdGlvbnMpID09PSBmYWxzZSlcblx0XHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fSxcblxuXHRzdWJtaXQ6IGZ1bmN0aW9uKCkge1xuXHRcdGZvciAodmFyIGYgaW4gYmF0dC5mb3Jtcykge1xuXHRcdFx0YmF0dC5mb3Jtc1tmXS5zdWJtaXQoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCogU2NyaXB0cyB0aGF0IGxvYWRTY3JpcHRzKCkgaXMgd2FpdGluZyBvbi5cblx0KiBUaGVzZSBhcmUgdXN1YWxseSBmcm9tIHRhZ3Mgc3BlY2lmaWVkIHVzaW5nICdzcmM9XCJwYXRoXCInIGluIHRoZSB0YWdcblx0KiBAYWNjZXNzIHByaXZhdGVcblx0Ki9cblx0bG9hZFNjcmlwdHNTcmM6IHt9LFxuXG5cdC8qKlxuXHQqIFNjcmlwdHMgdGhhdCBhcmUgd2FpdGluZyB0byBsb2FkIGZyb20gdGhpcyBkb2N1bWVudC5cblx0KiBTaW1pbGFyIHRvIGxvYWRTY3JpcHRzU3JjIGV4Y2VwdCB3ZSBoYXZlIHRoZXNlIGZyb20gaW5saW5lXG5cdCogQGFjY2VzcyBwcml2YXRlXG5cdCovXG5cdGxvYWRTY3JpcHRzSW5saW5lOiBbXSxcblxuXHQvKipcblx0KiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgc2NyaXB0IGN1cnJlbnRseSBiZWluZyBldmFsKCknZWRcblx0KiBUaGlzIGlzIHVzZWQgYnkgdGhlICQod2luZG93KS5vbignZXJyb3InKSBoYW5kbGVyIHRvIGRpc3BsYXkgYSBuaWNlIG1lc3NhZ2UgcmF0aGVyIHRoYW4ganVzdCBnaXZpbmcgdXBcblx0KiBAdmFyIGFycmF5XG5cdCogQGFjY2VzcyBwcml2YXRlXG5cdCovXG5cdGV2YWxJbmZvOiBudWxsLFxuXG5cdC8qKlxuXHQqIFByb2Nlc3MgYWxsIDxzY3JpcHQgdHlwZT1cImJhdHRcIiBbc3JjPVwicGF0aFwiXS8+IHRhZ3Ncblx0Ki9cblx0bG9hZFNjcmlwdHM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciByZWFkeSA9IDE7XG5cdFx0JCgnc2NyaXB0W3R5cGU9XCJiYXR0XCJdJykuZWFjaChmdW5jdGlvbigpIHtcblx0XHRcdHZhciBzY3JpcHQgPSAkKHRoaXMpO1xuXHRcdFx0dmFyIHNjcmlwdFNyYyA9IHNjcmlwdC5hdHRyKCdzcmMnKTtcblx0XHRcdGlmIChzY3JpcHRTcmMpIHsgLy8gSGFzIGFuIHNyYz1cInBhdGhcIiBhdHRyaWJ1dGVcblx0XHRcdFx0aWYgKGJhdHQubG9hZFNjcmlwdHNTcmNbc2NyaXB0U3JjXSA9PSAnbG9hZGluZycpIHsgLy8gU3RpbGwgd2FpdGluZyBmb3IgdGhpcyBzY3JpcHQgdG8gbG9hZFxuXHRcdFx0XHRcdHJlYWR5ID0gMDtcblx0XHRcdFx0fSBlbHNlIGlmIChiYXR0LmxvYWRTY3JpcHRzU3JjW3NjcmlwdFNyY10gPT0gJ2xvYWRlZCcpIHsgLy8gTG9hZGVkIGNvbnRlbnQgLSB0aGlzIHNjcmlwdCBpcyByZWFkeVxuXHRcdFx0XHRcdC8vIERvIG5vdGhpbmdcblx0XHRcdFx0fSBlbHNlIGlmICghYmF0dC5sb2FkU2NyaXB0c1NyY1tzY3JpcHRTcmNdKSB7IC8vIEZpcnN0IG1lbnRpb24gb2YgdGhpcyBzY3JpcHQgd2UndmUgc2VlbiAtIHRyaWdnZXIgQUpBWCBsb2FkXG5cdFx0XHRcdFx0YmF0dC5sb2FkU2NyaXB0c1NyY1tzY3JpcHRTcmNdID0gJ2xvYWRpbmcnO1xuXHRcdFx0XHRcdCQuYWpheCh7XG5cdFx0XHRcdFx0XHR1cmw6IHNjcmlwdFNyYyxcblx0XHRcdFx0XHRcdGRhdGFUeXBlOiAndGV4dCcsXG5cdFx0XHRcdFx0XHR0eXBlOiAnR0VUJyxcblx0XHRcdFx0XHRcdGRhdGE6IHtub2hlYWRlcnM6IDF9LFxuXHRcdFx0XHRcdFx0Y2FjaGU6IHRydWUsXG5cdFx0XHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbihodG1sKSB7XG5cdFx0XHRcdFx0XHRcdGJhdHQubG9hZFNjcmlwdHNTcmNbc2NyaXB0U3JjXSA9ICdsb2FkZWQnO1xuXHRcdFx0XHRcdFx0XHRzY3JpcHQucmVwbGFjZVdpdGgoaHRtbCk7XG5cdFx0XHRcdFx0XHRcdGJhdHQubG9hZFNjcmlwdHMoKTtcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRlcnJvcjogZnVuY3Rpb24oanF4aHIsIGVyclRleHQsIGVyclRocm93bikge1xuXHRcdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ0Vycm9yIHdoaWxlIGxvYWRpbmcgPHNjcmlwdCBzcmM9XCInICsgc2NyaXB0U3JjICsgJ1wiLz4nLCBlcnJUZXh0LCBlcnJUaHJvd24pOyAvLyBGSVhNRTogZGVhbCB3aXRoIHRoaXMgZ3JhY2VmdWxseVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHJlYWR5ID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHsgLy8gTG9hZCBmcm9tIGNvbnRlbnRcblx0XHRcdFx0dmFyIG5ld0lkID0gYmF0dC5nZXRVbmlxdWVJZCgnYmF0dC0nKTtcblx0XHRcdFx0c2NyaXB0LmJlZm9yZSgnPGRpdiBpZD1cIicgKyBuZXdJZCArICdcIj48L2Rpdj4nKVxuXHRcdFx0XHR2YXIgZm9ybSA9IHthY3Rpb246IHNjcmlwdC5hdHRyKCdhY3Rpb24nKX07XG5cdFx0XHRcdGJhdHQubG9hZFNjcmlwdHNJbmxpbmUucHVzaChcblx0XHRcdFx0XHQnJChcXCcjJyArIG5ld0lkICsgJ1xcJykuYmF0dCgnICsgc2NyaXB0Lmh0bWwoKSArICcsICcgKyBKU09OLnN0cmluZ2lmeShmb3JtKSArICcpOydcblx0XHRcdFx0KTtcblx0XHRcdFx0c2NyaXB0LnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGlmIChyZWFkeSkge1xuXHRcdFx0Ly8gSW5zdGFsbCBnbG9iYWwgZXJyb3IgaGFuZGxlciB7e3tcblx0XHRcdGlmICgkLmJyb3dzZXIuY2hyb21lKSB7XG5cdFx0XHRcdCQod2luZG93KS5vbignZXJyb3InLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0YmF0dC5nbG9iYWxFcnJvckhhbmRsZXIoZS5vcmlnaW5hbEV2ZW50Lm1lc3NhZ2UsIG51bGwsIGUub3JpZ2luYWxFdmVudC5saW5lbm8pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAoJC5icm93c2VyLm1vemlsbGEpIHtcblx0XHRcdFx0d2luZG93Lm9uZXJyb3IgPSBiYXR0Lmdsb2JhbEVycm9ySGFuZGxlcjtcblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXHRcdFx0Zm9yICh2YXIgaSA9IGJhdHQubG9hZFNjcmlwdHNJbmxpbmUubGVuZ3RoIC0gMTsgaSA+IC0xOyBpLS0pIHtcblx0XHRcdFx0dmFyIG1hdGNoZXMgPSAvXFwkXFwoJyguKiknXFwpXFwuYmF0dFxcKC8uZXhlYyhiYXR0LmxvYWRTY3JpcHRzSW5saW5lW2ldKTtcblx0XHRcdFx0YmF0dC5ldmFsSW5mbyA9IHtcblx0XHRcdFx0XHRsb2FkU2NyaXB0c0lubGluZU9mZnNldDogaSxcblx0XHRcdFx0XHRpZDogbWF0Y2hlc1sxXVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRldmFsKGJhdHQubG9hZFNjcmlwdHNJbmxpbmVbaV0pO1xuXHRcdFx0fVxuXHRcdFx0YmF0dC5ldmFsSW5mbyA9IG51bGw7XG5cdFx0XHRiYXR0LmxvYWRTY3JpcHRzSW5saW5lID0gW107XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJbmxpbmUgPHNjcmlwdD4gdGFncyB3YWl0aW5nIG9uJywgT2JqZWN0LmtleXMoYmF0dC5sb2FkU2NyaXB0c1NyYykpO1xuXHRcdH1cblx0fSxcblxuXHQvLyBTcGVjaWFsIGZ1bmN0aW9ucyB7e3tcblx0Z2xvYmFsRXJyb3JIYW5kbGVyOiBmdW5jdGlvbihtZXNzYWdlLCBmaWxlLCBsaW5lKSB7XG5cdFx0YmF0dC5zdG9wID0gMTtcblx0XHRpZiAoYmF0dC5ldmFsSW5mbykgeyAvLyBXZSBoYXZlIHNvbWV0aGluZyB0byBjb21wbGFpbiBhYm91dFxuXHRcdFx0dmFyIGJveCA9ICQoYmF0dC5ldmFsSW5mby5pZCk7XG5cdFx0XHRtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKC9eVW5jYXVnaHQgU3ludGF4RXJyb3I6IC8sICcnKTtcblx0XHRcdGJveC5hcHBlbmQoJzxkaXYgY2xhc3M9XCJhbGVydCBhbGVydC1ibG9jayBhbGVydC1lcnJvclwiPjxoMz5CYXR0IGZhaWxlZCB0byBsb2FkIC0gJyArIG1lc3NhZ2UgKyAobGluZSA/ICcgKExpbmU6ICcgKyBsaW5lICsgJyknIDogJycpICsgJzwvaDM+PC9kaXY+Jyk7XG5cdFx0XHRpZiAobGluZSkgeyAvLyBXZSBoYXZlIGEgc3BlY2lmaWMgbGluZSBudW1iZXIgdG8gbG9vayBhdFxuXHRcdFx0XHR2YXIgYmxvY2sgPSBiYXR0LmxvYWRTY3JpcHRzSW5saW5lW2JhdHQuZXZhbEluZm8ubG9hZFNjcmlwdHNJbmxpbmVPZmZzZXRdLnNwbGl0KFwiXFxuXCIpO1xuXHRcdFx0XHRib3guZmluZCgnZGl2LmFsZXJ0Jylcblx0XHRcdFx0XHQuYXBwZW5kKCQoJzxwcmU+PC9wcmU+JykudGV4dChibG9jay5zbGljZSgwLCBsaW5lIC0gMSkuam9pbihcIlxcblwiKSkpXG5cdFx0XHRcdFx0LmFwcGVuZCgnPGRpdiBjbGFzcz1cImxhYmVsIGxhYmVsLXdhcm5pbmdcIj4nICsgbWVzc2FnZSArICc6PC9kaXY+Jylcblx0XHRcdFx0XHQuYXBwZW5kKCQoJzxwcmUgY2xhc3M9XCJhbGVydFwiPjwvcHJlPicpLnRleHQoYmxvY2suc2xpY2UobGluZSAtIDEsIGxpbmUpKSlcblx0XHRcdFx0XHQuYXBwZW5kKCQoJzxwcmU+PC9wcmU+JykudGV4dChibG9jay5zbGljZShsaW5lKS5qb2luKFwiXFxuXCIpKSk7XG5cdFx0XHRcdFxuXHRcdFx0fSBlbHNlIHsgLy8gV2UgaGF2ZSBubyBpZGVhIHdoZXJlIHRoZSBlcnJvciBvY2N1cmVkXG5cdFx0XHRcdGJveC5maW5kKCdkaXYuYWxlcnQnKS5hcHBlbmQoXG5cdFx0XHRcdFx0JCgnPHByZT48L3ByZT4nKS50ZXh0KGJhdHQubG9hZFNjcmlwdHNJbmxpbmVbYmF0dC5ldmFsSW5mby5sb2FkU2NyaXB0c0lubGluZU9mZnNldF0pXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXHQvLyB9fX1cblx0Ly8gVXRpbGl0eSBmdW5jdGlvbnMge3t7XG5cdC8qKlxuXHQqIFBhcnNlIGEgTXVzdGFjaGUgdGVtcGxhdGVcblx0KiBAcGFyYW0gc3RyaW5nIHN0cmluZyBUaGUgc3RyaW5nIHRvIHBhcnNlIGFuZCByZXR1cm5cblx0KiBAcGFyYW0gb2JqZWN0IEFkZGl0aW9uYWwgb2JqZWN0IGRhdGEgdG8gaW5jbHVkZSBpbiB0aGUgdGVtcGxhdGVcblx0KiBAcmV0dXJuIHN0cmluZyBUaGUgcGFyc2VkIHN0cmluZ1xuXHQqL1xuXHRwYXJzZTogZnVuY3Rpb24oc3RyaW5nLCBkYXRhKSB7XG5cdFx0dmFyIGRhdGEgPSAkLmV4dGVuZCh7fSwgYmF0dC5wYXJzZUdsb2JhbHMsIGRhdGEpO1xuXHRcdHZhciBvdXQgPSBNdXN0YWNoZS5yZW5kZXIoc3RyaW5nLCBkYXRhKTtcblx0XHQvLyBjb25zb2xlLmxvZygnQkFUVC5QQVJTRScsIHN0cmluZywgJz0nLCBvdXQsIGRhdGEpO1xuXHRcdHJldHVybiBvdXQ7XG5cdH0sXG5cblx0LyoqXG5cdCogU2FuaXRpemUgYSBzdHJpbmcgYW5kIHJldHVybiB0aGUgc2FmZSB2ZXJzaW9uIGRldm9pZCBvZiBhbnl0aGluZyBkYW5nZXJvdXNcblx0KiBAcGFyYW0gc3RyaW5nIHZhbHVlIFRoZSBzdHJpbmcgdG8gc2FuaXRpemVcblx0KiBAcGFyYW0gc3RyaW5nIHByZWZpeCBPcHRpb25hbCBwcmVmaXggdG8gcHJlcGVuZCB0byB0aGUgb3V0cHV0XG5cdCogQHJldHVybiBzdHJpbmcgVGhlIHNhZmUgdmVyc2lvbiBvZiB0aGUgaW5wdXQgJ3ZhbHVlJ1xuXHQqL1xuXHRzYWZlU3RyaW5nOiBmdW5jdGlvbih2YWx1ZSwgcHJlZml4KSB7XG5cdFx0cmV0dXJuIChwcmVmaXg/cHJlZml4OicnKSArIHZhbHVlLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTldKy9nLCAnLScpO1xuXHR9LFxuXG5cdC8qKlxuXHQqIFJldHVybiBhIHVuaXF1ZSBJRCBmb3IgYW4gaXRlbSBiYXNlZCBvbiBhIHByZWZpeFxuXHQqIFRoaXMgaXMgdXN1YWxseSB1c2VkIHRvIGFsbG9jYXRlIGFuIEhUTUwgSUQgdG8gYW4gZWxlbWVudCB0aGF0IGRvZXNudCBhbHJlYWR5IGhhdmUgb25lXG5cdCovXG5cdGdldFVuaXF1ZUlkOiBmdW5jdGlvbihwcmVmaXgpIHtcblx0XHRpZiAoIXByZWZpeClcblx0XHRcdHByZWZpeCA9ICdiYXR0LSc7XG5cdFx0d2hpbGUgKDEpIHtcblx0XHRcdHZhciBpZCA9IHByZWZpeCArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSo5OTk5OSk7XG5cdFx0XHRpZiAoJCgnIycgKyBpZCkubGVuZ3RoID09IDApXG5cdFx0XHRcdHJldHVybiBpZDtcblx0XHR9XG5cdH1cblx0Ly8gfX19XG59O1xuXG5iYXR0LnJlYWR5KCk7XG5cbiQuZm4uZXh0ZW5kKHtcblx0LyoqXG5cdCogQ29udmVuaWVuY2UgY29uc3RydWN0b3IgdG8gaW52b2tlIEJhdHQgb24gYW4gZWxlbWVudFxuXHQqIEBwYXJhbSBzdHJpbmcganNvbiBSQVcgQmF0dCBKU09OIHNwZWlmaWNhdGlvblxuXHQqIEBwYXJhbSBvYmplY3QgZm9ybU9iamVjdCBBZGRpdGlvbmFsIHBhcmFtZXRlcnMgdG8gaW1wb3J0IHdoZW4gY3JlYXRpbmcgdGhlIHdyYXBwZXIgZm9ybSBlLmcuIHthY3Rpb246ICcvc3VibWl0L2hlcmUnfVxuXHQqL1xuXHRiYXR0OiBmdW5jdGlvbihqc29uLCBmb3JtT2JqZWN0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9ICQodGhpcyk7XG5cdFx0XHR2YXIgaWQgPSBtZS5hdHRyKCdpZCcpO1xuXHRcdFx0dmFyIGNvbnRlbnQgPSBqc29uIHx8IG1lLnRleHQoKTtcblx0XHRcdGlmICghaWQpIHsgLy8gTWFrZSBzdXJlIHRoZSBpdGVtIGhhcyBhbiBJRCAtIG1ha2Ugb25lIGlmIG5lY2Vzc2FyeVxuXHRcdFx0XHRpZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2JhdHQtZm9ybS0nKTtcblx0XHRcdFx0bWUuYXR0cignaWQnLCBpZClcblx0XHRcdH1cblx0XHRcdGlmIChiYXR0LmlzUmVhZHkpIHtcblx0XHRcdFx0YmF0dC5mb3Jtc1tpZF0gPSBiYXR0Lm1ha2VPYmplY3QoJ2Zvcm0nKTtcblx0XHRcdFx0YmF0dC5mb3Jtc1tpZF0uc2V0KGNvbnRlbnQpO1xuXHRcdFx0XHRpZiAoZm9ybU9iamVjdClcblx0XHRcdFx0XHQkLmV4dGVuZChiYXR0LmZvcm1zW2lkXSwgZm9ybU9iamVjdCk7XG5cdFx0XHRcdGJhdHQuZm9ybXNbaWRdLnNldHVwLmNhbGwoYmF0dC5mb3Jtc1tpZF0sIG1lKTtcblx0XHRcdFx0YmF0dC5mb3Jtc1tpZF0ucmVuZGVyLmNhbGwoYmF0dC5mb3Jtc1tpZF0pO1xuXHRcdFx0fSBlbHNlIHsgLy8gTm90IHlldCByZWFkeVxuXHRcdFx0XHRjb25zb2xlLmxvZygnQmF0dCBub3QgeWV0IHJlYWR5LiBEZWZlcmVkIGxvYWQgZm9yIGZvcm0nLCBpZCk7XG5cdFx0XHRcdGJhdHQuc2V0cy5wdXNoKHtcblx0XHRcdFx0XHRlbGVtZW50OiBtZSxcblx0XHRcdFx0XHRjb250ZW50OiBjb250ZW50XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8gVHJpZ2dlciBpbml0aWFsIHN3ZWVwIGZvciA8c2NyaXB0IHR5cGU9XCJiYXR0XCIvPiB0YWdzXG4kKGJhdHQubG9hZFNjcmlwdHMpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb250YWluZXJEcmF3OiAnYnV0dG9ucycsXG5cdFx0YWN0aW9uOiAnbm90aGluZycsXG5cdFx0Y2xhc3NlczogJ2J0bicsXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc3VwZXIucmVuZGVyLmNhbGwodGhpcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0Y29udGFpbmVyRHJhdzogJ2hpZGUtbGFiZWwnLFxuXHRcdHZhbHVlOiBudWxsLCAvLyBWYWx1ZSBjYW4gb25seSBiZSAnMCcgb3IgJzEnXG5cblx0XHRyZXF1aXJlZDogZmFsc2UsXG5cdFx0cmVhZE9ubHk6IG51bGwsXG5cdFx0ZXJyb3JSZXF1aXJlZDogJ1N0cmluZyByZXF1aXJlZCcsXG5cblx0XHRjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZWxlbWVudC5maW5kKCdpbnB1dFt0eXBlPWNoZWNrYm94XScpLmlzKCc6Y2hlY2tlZCcpID8gJzEnIDogJzAnO1xuXHRcdFx0dGhpcy5zdXBlci5jaGFuZ2UuY2FsbCh0aGlzKTtcblx0XHR9LFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lXG5cdFx0XHRcdC5lbGVtZW50ID0gJCgnPGxhYmVsIGNsYXNzPVwiY2hlY2tib3hcIj48aW5wdXQgdHlwZT1cImNoZWNrYm94XCIvPiAnICsgbWUudGl0bGUgKyAnPC9sYWJlbD4nKVxuXHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLmNoYW5nZS5jYWxsKG1lKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gbWU7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLnZhbHVlKSB7XG5cdFx0XHRcdG1lLmVsZW1lbnQuYXR0cignY2hlY2tlZCcsICdjaGVja2VkJyk7XG5cdFx0XHRcdG1lLnZhbHVlID0gJzEnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bWUuZWxlbWVudC5yZW1vdmVBdHRyKCdjaGVja2VkJyk7XG5cdFx0XHRcdG1lLnZhbHVlID0gJzAnO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobWUucmVhZE9ubHkpXG5cdFx0XHRcdG1lLmVsZW1lbnRcblx0XHRcdFx0XHQuYXR0cigncmVhZG9ubHknLCAncmVhZG9ubHknKVxuXG5cdFx0XHRcdFx0LmFkZENsYXNzKCdkaXNhYmxlZElucHV0Jyk7XG5cdFx0XHRyZXR1cm4gbWU7XG5cdFx0fSxcblxuXHRcdHZhbGlkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmICh0aGlzLnJlcXVpcmVkICYmICF0aGlzLnZhbHVlKVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvclJlcXVpcmVkO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRyZW5kZXJUYWc6ICc8c2VsZWN0Pjwvc2VsZWN0PicsXG5cdFx0Y2hvaWNlczoge1xuXHRcdFx0Zm9vOiAnRm9vJyxcblx0XHRcdGJhcjogJ0JhcicsXG5cdFx0XHRiYXo6ICdCYXonXG5cdFx0fSxcblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0bWUuZWxlbWVudCA9ICQobWUucmVuZGVyVGFnKTtcblx0XHRcdG1lLmVsZW1lbnQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRtZS52YWx1ZSA9ICQodGhpcykudmFsKCk7XG5cdFx0XHRcdG1lLmNoYW5nZS5jYWxsKG1lKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmVsZW1lbnQuZW1wdHkoKTtcblx0XHRcdGZvciAodmFyIGlkIGluIG1lLmNob2ljZXMpIHtcblx0XHRcdFx0bWUuZWxlbWVudC5hcHBlbmQoJzxvcHRpb24gdmFsdWU9XCInICsgaWQgKyAnXCI+JyArIG1lLmNob2ljZXNbaWRdICsgJzwvb3B0aW9uPicpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobWUudmFsdWUpIHtcblx0XHRcdFx0bWUuZWxlbWVudC52YWwobWUudmFsdWUpO1xuXHRcdFx0fSBlbHNlIHsgLy8gTm8gdmFsdWUgLSBzZWxlY3QgdGhlIGZpcnN0XG5cdFx0XHRcdG1lLmVsZW1lbnRcblx0XHRcdFx0XHQudmFsKCBtZS5lbGVtZW50LmZpbmQoJ29wdGlvbjpmaXJzdCcpLmF0dHIoJ3ZhbHVlJykgKVxuXHRcdFx0XHRcdC50cmlnZ2VyKCdjaGFuZ2UnKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRyZW5kZXJUYWc6ICc8ZGl2PjwvZGl2PicsXG5cdFx0Y2hvaWNlczoge30sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblxuXHRcdFx0dGhpcy5lbGVtZW50LmVtcHR5KCk7XG5cdFx0XHRmb3IgKHZhciBpZCBpbiB0aGlzLmNob2ljZXMpIHtcblx0XHRcdFx0dmFyIGxhYmVsID0gJCgnPGxhYmVsIGNsYXNzPVwicmFkaW9cIj48L2xhYmVsPicpXG5cdFx0XHRcdFx0LmFwcGVuZFRvKHRoaXMuZWxlbWVudCk7XG5cdFx0XHRcdHZhciByYWRpbyA9ICQoJzxpbnB1dCB0eXBlPVwicmFkaW9cIiBuYW1lPVwiJyArIG1lLmlkICsgJ1wiIHZhbHVlPVwiJyArIGlkICsgJ1wiPicgKyB0aGlzLmNob2ljZXNbaWRdICsgJzwvbGFiZWw+Jylcblx0XHRcdFx0XHQuYXBwZW5kVG8obGFiZWwpXG5cdFx0XHRcdFx0Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdG1lLnZhbHVlID0gJCh0aGlzKS52YWwoKTtcblx0XHRcdFx0XHRcdG1lLmNoYW5nZS5jYWxsKG1lKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMudmFsdWUpXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5maW5kKCdpbnB1dFt2YWx1ZT1cIicgKyB0aGlzLnZhbHVlICsgJ1wiXScpLnByb3AoJ2NoZWNrZWQnLCB0cnVlKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjaGlsZHJlbjoge30sXG5cdFx0Y2hpbGRyZW5PcmRlcjogW10sXG5cdFx0Y29udGFpbmVyRHJhdzogJ3JvdycsXG5cdFx0aW1wbHlDaGlsZDogJ3Vua25vd24nLCAvLyBEZWZhdWx0IHRvIHRoaXMgaWYgbm8gY2hpbGQgdHlwZSBpcyBzcGVjaWZpZWRcblx0XHRkYXRhU291cmNlOiBudWxsLCAvLyBXaGF0IGRhdGEgc291cmNlIHRvIHVzZSAodXN1YWxseSBhIGhhc2ggc3RydWN0dXJlKVxuXHRcdHJlbmRlclRhZzogJzxkaXY+PC9kaXY+JywgLy8gV2hhdCB3cmFwcGVyIHRvIHVzZSB3aGVuIGRyYXdpbmcgdGhlIGNvbnRhaW5lclxuXHRcdGNsYXNzZXM6ICcnLFxuXG5cdFx0LyoqXG5cdFx0KiBSdW5zIGEgZnVuY3Rpb24gb24gZWFjaCBjaGlsZCBvZiB0aGlzIGNvbnRhaW5lclxuXHRcdCogVGhpcyBmdW5jdGlvbiBpcyByZWN1cnNpdmUuIElmIHlvdSByZXF1aXJlIGp1c3QgdGhlIGltbWVkaWF0ZSBjaGlsZHJlbiB1c2UgJC5lYWNoKGNvbnRhaW5lci5jaGlsZHJlbiwgZnVuY3Rpb24oKSB7IH0pXG5cdFx0KiBAcGFyYW0gY2FsbGJhY2sgY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJ1bi4gQ2FsbGVkIGluIHRoZSBmb3JtYXQgZnVuY3Rpb24oKSB7fSBzZXR0aW5nICd0aGlzJyB0byB0aGUgY3VycmVudCBjb250ZXh0XG5cdFx0KiBAcGFyYW0gaGFzaCBvcHRpb25zIEEgaGFzaCBvZiBvcHRpb25zIHRvIHVzZSB3aGVuIGZpbHRlcmluZ1xuXHRcdCogQHBhcmFtIG9iamVjdCBvYmplY3QgQ29udGV4dCBvYmplY3QgKGludGVybmFsIHVzZSBvbmx5KVxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRlYWNoQ2hpbGQ6IGZ1bmN0aW9uKGNhbGxiYWNrLCBvcHRpb25zLCBjb250ZXh0KSB7XG5cdFx0XHRpZiAoIWNvbnRleHQpXG5cdFx0XHRcdGNvbnRleHQgPSB0aGlzO1xuXHRcdFx0aWYgKCFjb250ZXh0LmNoaWxkcmVuKVxuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdHZhciBzZXR0aW5ncyA9ICQuZXh0ZW5kKHt9LCB7XG5cdFx0XHRcdGFuZFNlbGY6IGZhbHNlLCAvLyBJbmNsdWRlIHRoaXMgaXRlbSBpbiB0aGUgZmlyc3QgY2FsbGJhY2tcblx0XHRcdFx0ZGVwdGhGaXJzdDogZmFsc2UgLy8gVHJpZ2dlciBjYWxsYmFja3MgZnJvbSB0aGUgZGVlcGVzdCBmaXJzdFxuXHRcdFx0fSwgb3B0aW9ucyk7XG5cblx0XHRcdGlmIChzZXR0aW5ncy5hbmRTZWxmICYmICFzZXR0aW5ncy5kZXB0aEZpcnN0KVxuXHRcdFx0XHRjYWxsYmFjay5jYWxsKGNvbnRleHQpO1xuXG5cdFx0XHRpZiAoIWNvbnRleHQuY2hpbGRyZW5PcmRlcilcblx0XHRcdFx0Y29udGV4dC5jaGlsZHJlbk9yZGVyID0gT2JqZWN0LmtleXMoY29udGV4dC5jaGlsZHJlbik7XG5cblx0XHRcdGZvciAodmFyIGNpZCBpbiBjb250ZXh0LmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0dmFyIGNoaWxkID0gY29udGV4dC5jaGlsZHJlbltjb250ZXh0LmNoaWxkcmVuT3JkZXJbY2lkXV07XG5cdFx0XHRcdGlmICghc2V0dGluZ3MuZGVwdGhGaXJzdClcblx0XHRcdFx0XHRjYWxsYmFjay5jYWxsKGNoaWxkKTtcblx0XHRcdFx0aWYgKGNoaWxkLmNoaWxkcmVuKVxuXHRcdFx0XHRcdHRoaXMuZWFjaENoaWxkLmNhbGwoY2hpbGQsIGNhbGxiYWNrLCBvcHRpb25zLCBjaGlsZCk7XG5cdFx0XHRcdGlmIChzZXR0aW5ncy5kZXB0aEZpcnN0KVxuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwoY2hpbGQpO1xuXHRcdFx0fTtcblxuXHRcdFx0aWYgKHNldHRpbmdzLmFuZFNlbGYgJiYgIXNldHRpbmdzLmRlcHRoRmlyc3QpXG5cdFx0XHRcdGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBMb2NhdGUgYSBvYmplY3QgYnkgaXRzIElEIHVuZGVyIHRoaXMgb25lXG5cdFx0KiBAcGFyYW0gc3RyaW5nIGlkIFRoZSBJRCBvZiB0aGUgb2JqZWN0IHRvIGZpbmRcblx0XHQqIEBwYXJhbSBvYmplY3QgY29udGV4dCBJbnRlcm5hbCB1c2Ugb25seSAtIHByb3ZpZGUgdGhlIGNvbnRleHQgdG8gc2NhblxuXHRcdCogQHJldHVybiBudWxsfG9iamVjdCBFaXRoZXIgdGhlIGZvdW5kIG9iamVjdCBvciBudWxsXG5cdFx0Ki9cblx0XHRmaW5kOiBmdW5jdGlvbihpZCwgY29udGV4dCkge1xuXHRcdFx0aWYgKCFjb250ZXh0KVxuXHRcdFx0XHRjb250ZXh0ID0gdGhpcztcblxuXHRcdFx0aWYgKCFjb250ZXh0LmNoaWxkcmVuKVxuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdGlmIChjb250ZXh0LmNoaWxkcmVuW2lkXSlcblx0XHRcdFx0cmV0dXJuIGNvbnRleHQuY2hpbGRyZW5baWRdO1xuXG5cdFx0XHRmb3IgKHZhciBjIGluIGNvbnRleHQuY2hpbGRyZW4pIHtcblx0XHRcdFx0dmFyIGZvdW5kID0gdGhpcy5maW5kKGlkLCBjb250ZXh0LmNoaWxkcmVuW2NdKTtcblx0XHRcdFx0aWYgKGZvdW5kKVxuXHRcdFx0XHRcdHJldHVybiBmb3VuZDtcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBFeHRyYWN0IGFsbCAndXNlcycgZGlyZWN0aXZlcyBmcm9tIGEgY29tcGxleGx5IG5lc3RlZCBKU09OIG9iamVjdCBhbmQgcmV0dXJuIGFzIGFuIGFycmF5XG5cdFx0KiBAcGFyYW0gb2JqZWN0IGpzb24gVGhlIG5lc3RlZCBKU09OIG9iamVjdCB0byBwcm9jZXNzXG5cdFx0KiBAcmV0dXJuIGFycmF5IEFuIGFycmF5IG9mIGFsbCB1c2VzIGRpcmVjdGl2ZXNcblx0XHQqL1xuXHRcdGRldGVybWluZVVzZXM6IGZ1bmN0aW9uKGpzb24pIHtcblx0XHRcdHZhciB1c2VzID0ge307XG5cblx0XHRcdHZhciB1c2VzV29ya2VyID0gZnVuY3Rpb24oanNvbiwgdXNlcykgeyBcblx0XHRcdFx0JC5lYWNoKGpzb24sIGZ1bmN0aW9uKGksIGopIHtcblx0XHRcdFx0XHRpZiAoai5jaGlsZHJlbilcblx0XHRcdFx0XHRcdHVzZXNXb3JrZXIoai5jaGlsZHJlbiwgdXNlcylcblx0XHRcdFx0XHRpZiAoai51c2VzKVxuXHRcdFx0XHRcdFx0dXNlc1tqLnVzZXNdID0gMTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHVzZXNXb3JrZXIoanNvbiwgdXNlcyk7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmtleXModXNlcyk7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogQWRkIGEgbmV3IGJhdHQgb2JqZWN0IHRvIGEgY29udGFpbmVyXG5cdFx0KiBOT1RFOiBUaGlzIHdpbGwgbm90IHJlLXJlbmRlciB0aGUgcGFyZW50IHlvdSB3aWxsIGhhdmUgdG8gY2FsbCB0aGlzLnJlbmRlcigpIHRvIGRvIHRoYXRcblx0XHQqIEBwYXJhbSBtaXhlZCBKU09OIGRhdGEgdGhhdCBkZWZpbmVzIHRoZSBvYmplY3Rcblx0XHQqIEBwYXJhbSBzdHJpbmcgd2hlcmUgT3B0aW9uYWwgd2hlcmUgY29uZGl0aW9uLiBFbnVtIG9mOiAnbGFzdCcgKGRlZmF1bHQpLCAnYWZ0ZXInXG5cdFx0KiBAcGFyYW0gc3RyaW5nIGlkIElmIHdoZXJlPT0nYWZ0ZXInIHRoaXMgaXMgdGhlIGV4aXN0aW5nIGNoaWxkIHRvIGluc2VydCBhZnRlci4gSWYgdGhlIGNoaWxkIElEIGlzIG5vdCBmb3VuZCB0aGUgbmV3IGl0ZW0gaXMgYXBwZW5kZWRcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoaXMgY2hhaW5hYmxlIG9iamVjdFxuXHRcdCovXG5cdFx0YWRkQ2hpbGQ6IGZ1bmN0aW9uKG9iaiwgd2hlcmUsIGlkKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0dmFyIGNoaWxkID0gbnVsbDtcblxuXHRcdFx0aWYgKCFvYmoudXNlcykgLy8gSW5oZXJpdCAndXNlcycgZnJvbSBwYXJlbnQgaWYgbm90IHNwZWNpZmllZFxuXHRcdFx0XHRvYmoudXNlcyA9IG1lLnVzZXM7XG5cblx0XHRcdGlmIChvYmouaW1wb3J0KSB7IC8vIE5vIHR5cGUgZXhwbGljaXQgYnV0IGl0IGxvb2tzIGxpa2Ugd2UgYXJlIGluaGVyaXRpbmdcblx0XHRcdFx0dmFyIG1hdGNoZXMgPSAvXiguKilcXC4oLiopJC8uZXhlYyhvYmouaW1wb3J0KTtcblx0XHRcdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdFx0XHR2YXIgaW1wb3J0RmVlZCA9IG1hdGNoZXNbMV07XG5cdFx0XHRcdFx0dmFyIGltcG9ydElkID0gbWF0Y2hlc1syXTtcblx0XHRcdFx0XHRpZiAoIWJhdHQuZmVlZHNbaW1wb3J0RmVlZF0pIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignTm9uLWV4aXN0YW50IGZlZWQgdG8gaW1wb3J0IGZyb20uIEZlZWQ9JyArIGltcG9ydEZlZWQgKyAnLCBJRD0nICsgaW1wb3J0SWQpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIWJhdHQuZmVlZHNbaW1wb3J0RmVlZF0uY2hpbGRyZW5baW1wb3J0SWRdKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ05vbi1leGlzdGFudCBmZWVkIElEIHRvIGltcG9ydCBmcm9tLiBGZWVkPScgKyBpbXBvcnRGZWVkICsgJywgSUQ9JyArIGltcG9ydElkICsgJyAoZmVlZCBleGlzdHMgYnV0IGNoaWxkIGRvZXMgbm90KScpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH0gZWxzZSB7IC8vIEFsbCBpcyB3ZWxsXG5cdFx0XHRcdFx0XHRjaGlsZCA9IGJhdHQuZmVlZHNbaW1wb3J0RmVlZF0uY2hpbGRyZW5baW1wb3J0SWRdO1xuXHRcdFx0XHRcdFx0Y2hpbGQuZGF0YUJpbmRpbmcgPSBpbXBvcnRJZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7IC8vIEZJWE1FOiBXb3VsZCBiZSBuaWNlIGlmIHRoZXJlIHdlcmUgc29tZSBvdGhlciB3YXkgb2YgaW1wb3J0aW5nXG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKCdJbXBvcnQgcmVmZXJlbmNlIFwiJyArIG9iai5pbXBvcnQgKyAnXCIgaXMgaW52YWxpZC4gRm9ybWF0IG11c3QgYmUgXCJmZWVkLmlkXCInKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICghb2JqLnR5cGUgJiYgb2JqLnVzZXMgJiYgb2JqLmlkICYmIGJhdHQuZmVlZHNbb2JqLnVzZXNdLmNoaWxkcmVuW29iai5pZF0pIHsgLy8gTm8gdHlwZSBleHBsaWNpdCBidXQgaXQgbG9va3MgbGlrZSB3ZSBhcmUgaW5oZXJpdGluZ1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ0luaGVyaXRhbmNlIGZyb20gLnVzZXMgaXMgZGVwY3JlY2lhdGVkIScpO1xuXHRcdFx0XHRjaGlsZCA9IGJhdHQuZmVlZHNbb2JqLnVzZXNdLmNoaWxkcmVuW29iai5pZF07XG5cdFx0XHR9IGVsc2UgeyAvLyBUeXBlIGV4cGxpY2l0IE9SIG5vIHVzZXNcblx0XHRcdFx0Y2hpbGQgPSBiYXR0Lm1ha2VPYmplY3Qob2JqLnR5cGUgPyBvYmoudHlwZSA6IG1lLmltcGx5Q2hpbGQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIW9iai5pZCkgeyAvLyBTZXQgdXAgYW4gSUQgLSBldmVuIGlmIG9uZSBkb2VzbnQgYWxyZWFkeSBleGlzdFxuXHRcdFx0XHRvYmouaWQgPSBiYXR0LmdldFVuaXF1ZUlkKCdmaWVsZC0nKTtcblx0XHRcdFx0b2JqLmlkRmFrZSA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKCFvYmouaWRGYWtlICYmICFvYmoudGl0bGUpIC8vIFNldCB1cCBuaWNlIGxvb2tpbmcgdGl0bGUgaWYgZG9uZSBkb2VzbnQgZXhpc3Rcblx0XHRcdFx0b2JqLnRpdGxlID0gb2JqLmlkLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgb2JqLmlkLnN1YnN0cigxKTtcblxuXHRcdFx0aWYgKG9iai51c2VzICYmIGJhdHQuZmVlZHNbb2JqLnVzZXNdICYmIGJhdHQuZmVlZHNbb2JqLnVzZXNdLmNoaWxkcmVuW29iai5pZF0pIHsgLy8gVXNlcyBpcyBzb21ldGhpbmcgQU5EIHRoZXJlIGlzIGEgdGFibGUvY29sIHBhaXIgbWF0Y2hpbmcgdGhpcyBkZWZpbml0aW9uIC0gaW5oZWlydCBmcm9tIGJhc2UgY2xhc3MgKyB0YWJsZSArIG9wdGlvbnNcblx0XHRcdFx0Y2hpbGQgPSBiYXR0LmZlZWRzW29iai51c2VzXS5jaGlsZHJlbltvYmouaWRdO1xuXHRcdFx0XHRjaGlsZC5kYXRhQmluZGluZyA9IG9iai51c2VzICsgJy4nICsgb2JqLmlkO1xuXHRcdFx0XHQkLmV4dGVuZChjaGlsZCwgb2JqKTtcblx0XHRcdH0gZWxzZSAvLyBObyB1c2VzIGRpcmVjdGl2ZSAtIGp1c3QgaW5oZXJpdCBmcm9tIGJhc2UgY2xhc3MgKyBvcHRpb25zXG5cdFx0XHRcdCQuZXh0ZW5kKGNoaWxkLCBvYmopO1xuXG5cdFx0XHRzd2l0Y2ggKHdoZXJlKSB7XG5cdFx0XHRcdGNhc2UgJ2FmdGVyJzpcblx0XHRcdFx0XHR2YXIgZXhpc3RpbmcgPSBtZS5jaGlsZHJlbk9yZGVyLmluZGV4T2YoaWQpO1xuXHRcdFx0XHRcdGlmICghaWQpIHsgXG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyLmFkZENoaWxkKG9iamVjdCwgXCJhZnRlclwiLCBcIicgKyBpZCArICdcIik+IEFza2VkIHRvIGluc2VydCBhZnRlciBub24tZXhpc3RhbnQgaWQgXCInICsgaWQgKyAnXCIuIEluc2VydGluZyBhdCBlbmQgaW5zdGVhZCcpO1xuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlci5wdXNoKGNoaWxkLmlkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlci5zcGxpY2UoZXhpc3RpbmcgKyAxLCAwLCBjaGlsZC5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdsYXN0Jzpcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyLnB1c2goY2hpbGQuaWQpO1xuXHRcdFx0fVxuXHRcdFx0bWUuY2hpbGRyZW5bY2hpbGQuaWRdID0gY2hpbGQ7XG5cdFx0XHRjaGlsZC5zZXR1cCgpO1xuXG5cdFx0XHRpZiAoY2hpbGQuY2hpbGRyZW4pIC8vIEluaXRhbGl6ZSBhbGwgY2hpbGRyZW5cblx0XHRcdFx0Y2hpbGQuc2V0KGNoaWxkLmNoaWxkcmVuLCB0cnVlKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFJlbW92ZSBhIGNoaWxkIG9iamVjdCBieSBpdHMgSURcblx0XHQqIEBwYXJhbSBzdHJpbmcgaWQgVGhlIElEIG9mIHRoZSBjaGlsZCB0byByZW1vdmVcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoaXMgY2hhaW5hYmxlIG9iamVjdFxuXHRcdCovXG5cdFx0cmVtb3ZlQ2hpbGQ6IGZ1bmN0aW9uKGlkKSB7XG5cdFx0XHR2YXIgZXhpc3RpbmcgPSB0aGlzLmNoaWxkcmVuT3JkZXIuaW5kZXhPZihpZCk7XG5cdFx0XHRpZiAoIWlkKSB7IFxuXHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyLnJlbW92ZUNoaWxkKFwiJyArIGlkICsgJ1wiKT4gQXNrZWQgdG8gcmVtb3ZlIG5vbi1leGlzdGFudCBpZCBcIicgKyBpZCArICdcIicpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5jaGlsZHJlbk9yZGVyLnNwbGljZShleGlzdGluZywgMSk7XG5cdFx0XHRcdGRlbGV0ZSB0aGlzLmNoaWxkcmVuW2lkXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFRha2UgYSBjb21wbGV4IEpTT04gYXJyYXkgYW5kIGNhbGwgYWRkKCkgb24gZWFjaCBpdGVtXG5cdFx0KiBUaGlzIGZ1bmN0aW9uIGFsc28gY2xlYXJzIHRoZSBleGlzdGluZyBjaGlsZHJlblxuXHRcdCogQHBhcmFtIHN0cmluZyBqc29uIFRoZSBKU09OIG9iamVjdCB0byBwcm9jZXNzXG5cdFx0KiBAcGFyYW0gYm9vbCBpc0NoaWxkIEludGVybmFsIHByb3BlcnR5IHRvIHByZXZlbnQgcmVjdXJzaXZlICd1c2VzJyBsb2Fkc1xuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRzZXQ6IGZ1bmN0aW9uKGpzb24sIGlzQ2hpbGQpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5jaGlsZHJlbiA9IHt9O1xuXHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IFtdO1xuXG5cdFx0XHQvLyBQcmV2ZW50IHJhY2UgY29uZGl0aW9uIC0gcHJvY2Vzc2luZyB0cmVlIGJlZm9yZSBjaGlsZC51c2VzIG1vZHVsZSBsb2FkcyBhcmUgcmVhZHkge3t7XG5cdFx0XHRpZiAoIWlzQ2hpbGQpIHsgLy8gTWFzdGVyIHBhcmVudCBoYXMgYWxyZWFkeSBiZWVuIGludm9rZWQgLSB3ZSBhcmUgcHJvcGJhYmx5IGluc2lkZSBhIHJlY3Vyc2l2ZSBsb2FkXG5cdFx0XHRcdHZhciBub25Mb2FkZWRVc2VzID0gW107XG5cdFx0XHRcdHZhciBsb2FkcyA9IHRoaXMuZGV0ZXJtaW5lVXNlcyhqc29uKTtcblx0XHRcdFx0Zm9yICh2YXIgbCBpbiBsb2Fkcykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdSRVFVSVJFUycsIGxvYWRzW2xdLCBiYXR0LmZlZWRzW2xvYWRzW2xdXSk7XG5cdFx0XHRcdFx0aWYgKCFiYXR0LmZlZWRzW2xvYWRzW2xdXSlcblx0XHRcdFx0XHRcdG5vbkxvYWRlZFVzZXMucHVzaChiYXR0LnVzZXNQYXRoICsgbG9hZHNbbF0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChub25Mb2FkZWRVc2VzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdEZWZlciBsb2FkaW5nIGludG8gJywganNvbiwgJyB3YWl0IGZvciBtb2R1bGVzOicsIG5vbkxvYWRlZFVzZXMpO1xuXHRcdFx0XHRcdCRzY3JpcHQobm9uTG9hZGVkVXNlcywgZnVuY3Rpb24obm90Rm91bmQpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdMT0FERUQgTU9EVUxFUycsIG5vbkxvYWRlZFVzZXMsIG5vdEZvdW5kKTtcblx0XHRcdFx0XHRcdGlmIChiYXR0LnN0b3ApXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdG1lXG5cdFx0XHRcdFx0XHRcdC5zZXQoanNvbilcblx0XHRcdFx0XHRcdFx0LnJlbmRlcigpO1xuXHRcdFx0XHRcdH0sIGZ1bmN0aW9uKG5vdEZvdW5kKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ0NBTk5PVCBMT0FEIE1PRFVMRVMnLCBub3RGb3VuZCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyB9fX1cblxuXHRcdFx0JC5lYWNoKGpzb24sIGZ1bmN0aW9uKGksIG9iaikge1xuXHRcdFx0XHRtZS5hZGRDaGlsZChvYmopO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBSZXRyaWV2ZSB0aGUgbmV4dCBkYXRhIHJvdyBpZiAuZGF0YVNvdXJjZSBpcyBzcGVjaWZpZWRcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoZSBkYXRhIG9iamVjdCAoYWxzbyBzZXQgaW4gdGhpcy5kYXRhIGZvciBjb252ZW5pZW5jZSlcblx0XHQqL1xuXHRcdGdldERhdGE6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCF0aGlzLmRhdGFTb3VyY2UpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdiYXR0X2NvbnRhaW5lcj4gQXNrZWQgdG8gZ2V0RGF0YSgpIGJ1dCBubyBkYXRhU291cmNlIHNwZWNpZmllZCcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5kYXRhU291cmNlLmRhdGFSb3dPZmZzZXQrKztcblx0XHRcdFx0aWYgKHRoaXMuZGF0YVNvdXJjZS5kYXRhICYmIHRoaXMuZGF0YVNvdXJjZS5kYXRhLnBheWxvYWQgJiYgdGhpcy5kYXRhU291cmNlLmRhdGFSb3dPZmZzZXQgPCB0aGlzLmRhdGFTb3VyY2UuZGF0YS5wYXlsb2FkLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuZGF0YSA9IHRoaXMuZGF0YVNvdXJjZS5kYXRhLnBheWxvYWRbdGhpcy5kYXRhU291cmNlLmRhdGFSb3dPZmZzZXRdO1xuXHRcdFx0XHRcdHRoaXMuZGF0YVsnX3RhYmxlJ10gPSB0aGlzLmRhdGFTb3VyY2UudGFibGU7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZGF0YTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRyZXdpbmREYXRhOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZGF0YVNvdXJjZS5kYXRhUm93T2Zmc2V0ID0gLTE7XG5cdFx0XHR0aGlzLmRhdGEgPSBudWxsO1xuXHRcdFx0cmV0dXJuIHRoaXMuZGF0YTtcblx0XHR9LFxuXG5cdFx0Y2xlYXJEYXRhOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmICh0aGlzLmRhdGFTb3VyY2UpIHtcblx0XHRcdFx0ZGVsZXRlIHRoaXMuZGF0YVNvdXJjZS5kYXRhO1xuXHRcdFx0XHR0aGlzLnJld2luZERhdGEoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFRlbGwgdGhlIGNvbnRhaW5lciBkYXRhU291cmNlIHRvIGxvYWQgaXRzIGRhdGFcblx0XHQqIEBwYXJhbSBjYWxsYmFjayBzdWNjZXNzIEZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBkYXRhIGxvYWQgaGFzIGNvbXBsZXRlZFxuXHRcdCovXG5cdFx0bG9hZENvbnRhaW5lckRhdGE6IGZ1bmN0aW9uKHN1Y2Nlc3MpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRpZiAoIXRoaXMuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ05vIGRhdGFTb3VyY2Ugc3BlY2lmaWVkIHdoZW4gdHJ5aW5nIHRvIGxvYWQgZGF0YSEnLCB0aGlzKTtcblx0XHRcdH0gZWxzZSBpZiAoIXRoaXMuZGF0YVNvdXJjZS5mZWVkKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gZGF0YVNvdXJjZS5mZWVkIHNwZWNpZmllZCB3aGVuIHRyeWluZyB0byBsb2FkIGRhdGEhJyk7XG5cdFx0XHR9IGVsc2UgaWYgKCFiYXR0LmZlZWRzW3RoaXMuZGF0YVNvdXJjZS5mZWVkXSkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ1JlcXVlc3RlZCBkYXRhIGZyb20gZGF0YVNvdXJjZSBcIicgKyB0aGlzLmRhdGFTb3VyY2UuZmVlZCArICdcIiB0aGF0IGlzIG5vdCBsb2FkZWQhJyk7XG5cdFx0XHR9IGVsc2UgaWYgKCF0aGlzLmRhdGFTb3VyY2UuZGF0YSkgeyAvLyBEYXRhIG5vdCBhbHJlYWR5IGxvYWRlZFxuXHRcdFx0XHR2YXIgZHMgPSAkLmV4dGVuZCh7fSwgbWUuZGF0YVNvdXJjZSwge1xuXHRcdFx0XHRcdGZpZWxkczogT2JqZWN0LmtleXMoYmF0dC5mZWVkc1ttZS5kYXRhU291cmNlLmZlZWRdLmNoaWxkcmVuKVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAoZHMuZmlsdGVycykgeyAvLyBQYXJzZSBhbGwgZmlsdGVyIGFyZ3VtZW50c1xuXHRcdFx0XHRcdHZhciBuZXdGaWx0ZXJzID0ge307XG5cdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIGRzLmZpbHRlcnMpIHtcblx0XHRcdFx0XHRcdG5ld0ZpbHRlcnNba2V5XSA9IG1lLnBhcnNlKGRzLmZpbHRlcnNba2V5XSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRzLmZpbHRlcnMgPSBuZXdGaWx0ZXJzO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YmF0dC5mZWVkc1tkcy5mZWVkXS5nZXREYXRhKGRzLCBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHRcdFx0bWUuZGF0YVNvdXJjZS5kYXRhID0ganNvbjtcblx0XHRcdFx0XHRtZS5kYXRhU291cmNlLmRhdGFSb3dPZmZzZXQgPSAtMTtcblx0XHRcdFx0XHRtZS5yZW5kZXIoKTtcblx0XHRcdFx0fSwgZnVuY3Rpb24oZXJyVGV4dCwgZXJyVGhyb3duKSB7XG5cdFx0XHRcdFx0bWUuZWxlbWVudC5maW5kKCcuYmF0dC1sb2FkaW5nJykucmVtb3ZlKCk7XG5cdFx0XHRcdFx0bWUuZWxlbWVudC5hcHBlbmQoJzxkaXYgY2xhc3M9XCJhbGVydFwiPkVycm9yIGxvYWRpbmcgZGF0YTogJyArIGVyclRleHQgKyAnIC0gJyArIGVyclRocm93biArICc8L2Rpdj4nKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgeyAvLyBSZW5kZXIgY2hpbGRyZW4gd2l0aCBkYXRhXG5cdFx0XHRcdHN1Y2Nlc3MoKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBEcmF3IHRoaXMgY29udGFpbmVyIG9iamVjdFxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghbWUuZWxlbWVudCkge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnYmF0dF9mb3JtPiBUb2xkIHRvIHJlbmRlciBidXQgd2l0aCBubyBlbGVtZW50JywgbWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghbWUuY2hpbGRyZW5PcmRlciB8fCAhbWUuY2hpbGRyZW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdGlmICghbWUuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyPiBUb2xkIHRvIHJlbmRlciBidXQgSSBoYXZlIG5vIGNoaWxkcmVuIScsIG1lKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IE9iamVjdC5rZXlzKG1lLmNoaWxkcmVuKTtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBjaGlsZHJlbk9yZGVyIHNwZWNpZmllZC4gSW5oZXJpdGluZyBmcm9tIGNoaWxkcmVuIGhhc2ggaW4gaGFzaCBvcmRlciBpbnN0ZWFkJywgbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobWUuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRtZS5sb2FkQ29udGFpbmVyRGF0YShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmVtcHR5KCk7XG5cdFx0XHRcdFx0bWUucmV3aW5kRGF0YSgpO1xuXHRcdFx0XHRcdHZhciBkYXRhO1xuXHRcdFx0XHRcdHdoaWxlIChkYXRhID0gbWUuZ2V0RGF0YSgpKSB7XG5cdFx0XHRcdFx0XHQvLyBDb3B5IG1lIGRhdGEgaW50byBhbGwgY2hpbGRyZW5cblx0XHRcdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuZGF0YUJpbmRpbmcpXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy52YWx1ZSA9IGRhdGFbdGhpcy5kYXRhQmluZGluZ107XG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbaV1dO1xuXHRcdFx0XHRcdFx0XHRjaGlsZC5sb2FkRGF0YSgpO1xuXHRcdFx0XHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblxuXHRcdFx0XHRcdFx0XHRtZS5yZW5kZXJSb3cobWUuZWxlbWVudCwgY2hpbGQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgeyAvLyBObyBkYXRhIHRvIGNhcmUgYWJvdXRcblx0XHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpO1xuXHRcdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0XHR2YXIgY2hpbGQgPSBtZS5jaGlsZHJlblttZS5jaGlsZHJlbk9yZGVyW2NdXTtcblx0XHRcdFx0XHRjaGlsZC5sb2FkRGF0YSgpO1xuXHRcdFx0XHRcdGNoaWxkLnJlbmRlcigpO1xuXG5cdFx0XHRcdFx0bWUucmVuZGVyUm93KG1lLmVsZW1lbnQsIGNoaWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG1lLmNsYXNzZXMpXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hZGRDbGFzcyhtZS5jbGFzc2VzKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXJSb3c6IGZ1bmN0aW9uKGVsZW1lbnQsIGNoaWxkKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybigncmVuZGVyUm93IG9mIG5vbmUtZXhpc3RhbnQgZWxlbWVudCBmb3IgY2hpbGQnLCBjaGlsZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c3dpdGNoIChjaGlsZC5jb250YWluZXJEcmF3KSB7IC8vIFdoaWNoIG1ldGhvZCB0byB1c2Ugd2hlbiBkcmF3aW5nIHRoZSBmaWVsZD9cblx0XHRcdFx0Y2FzZSAnZGVidWcnOlxuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kKCc8ZGl2PkRFQlVHIENISUxEPC9kaXY+Jyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3RhYmxlLWNlbGwnOlxuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIgPSAkKCc8dGQ+PC90ZD4nKTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmFwcGVuZChjaGlsZC5lbGVtZW50KTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC53cmFwcGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAncm93Jzpcblx0XHRcdFx0Y2FzZSAnZW50aXJlLXJvdyc6IC8vIERvbnQgdHJ5IHRvIGRvIGFueXRoaW5nXG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmQoY2hpbGQuZWxlbWVudCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3NwYW4nOiAvLyBFeHBhbmQgb3ZlciB0aGUgcm93IGJ1dCB3aXRoIHNwYWNpbmdcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyID0gJCgnPGRpdj48L2Rpdj4nKTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmZpcnN0KCkuYXBwZW5kKGNoaWxkLmVsZW1lbnQpOyAvLyBMb2FkIHRoZSBjaGlsZCBpbnRvIHRoZSAuY29udHJvbHMgZGl2XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmQoY2hpbGQud3JhcHBlcik7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ2J1dHRvbnMnOiAvLyBEcmF3IGFzIGJ1dHRvbiBncm91cFxuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIgPSAkKFxuXHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJmb3JtLWFjdGlvbnNcIiBzdHlsZT1cInBhZGRpbmctbGVmdDogMHB4OyB0ZXh0LWFsaWduOiBjZW50ZXJcIj4nXG5cdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj48L2Rpdj4nXG5cdFx0XHRcdFx0XHQrICc8L2Rpdj4nXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmNoaWxkcmVuKCdkaXYnKS5hcHBlbmQoY2hpbGQuZWxlbWVudCk7IC8vIExvYWQgdGhlIGNoaWxkIGludG8gdGhlIC5jb250cm9scyBkaXZcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC53cmFwcGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnaGlkZS1sYWJlbCc6IC8vIERyYXcgaW4gdXN1YWwgcGxhY2UgYnV0IHdpdGhvdXQgYSBsYWJlbFxuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIgPSAkKFxuXHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJjb250cm9sLWdyb3VwXCI+J1xuXHRcdFx0XHRcdFx0KyAnPGRpdiBjbGFzcz1cImNvbnRyb2xzXCI+PC9kaXY+J1xuXHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0Y2hpbGQud3JhcHBlci5maW5kKCcuY29udHJvbHMnKS5hcHBlbmQoY2hpbGQuZWxlbWVudCk7IC8vIExvYWQgdGhlIGNoaWxkIGludG8gdGhlIC5jb250cm9scyBkaXZcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC53cmFwcGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnbm9ybWFsJzpcblx0XHRcdFx0Y2FzZSAnd2l0aC1sYWJlbCc6IC8vIFdyYXAgY2hpbGQgaW4gdGhlIHVzdWFsIGZsdWZmIC0gbGFiZWwgKyBpbnB1dCBhcmVhXG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0Y2hpbGQud3JhcHBlciA9ICQoXG5cdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cImNvbnRyb2wtZ3JvdXBcIj4nXG5cdFx0XHRcdFx0XHQrICc8bGFiZWwgY2xhc3M9XCJjb250cm9sLWxhYmVsXCI+JyArIChjaGlsZC50aXRsZSB8fCBjaGlsZC5pZCkgKyAnPC9sYWJlbD4nXG5cdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwiY29udHJvbHNcIj48L2Rpdj4nXG5cdFx0XHRcdFx0XHQrICc8L2Rpdj4nXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmZpbmQoJy5jb250cm9scycpLmFwcGVuZChjaGlsZC5lbGVtZW50KTsgLy8gTG9hZCB0aGUgY2hpbGQgaW50byB0aGUgLmNvbnRyb2xzIGRpdlxuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kKGNoaWxkLndyYXBwZXIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHZhbGlkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnZhbGlkYXRlQ2hpbGRyZW4uY2FsbCh0aGlzKTtcblx0XHR9LFxuXG5cdFx0dmFsaWRhdGVDaGlsZHJlbjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgZXJyb3JzID0ge307XG5cdFx0XHRmb3IgKHZhciBjIGluIHRoaXMuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHR2YXIgaWQgPSB0aGlzLmNoaWxkcmVuT3JkZXJbY107XG5cdFx0XHRcdHZhciBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baWRdO1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gY2hpbGQudmFsaWRhdGUoKTtcblx0XHRcdFx0aWYgKHR5cGVvZiByZXN1bHQgPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRlcnJvcnNbaWRdID0gcmVzdWx0O1xuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2FycmF5Jykge1xuXHRcdFx0XHRcdCQuZXh0ZW5kKGVycm9ycywgcmVzdWx0KTtcblx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgcmVzdWx0ID09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdGVycm9yc1tpZF0gPSAnU29tZXRoaW5nIHdlbnQgd3JvbmcnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZXJyb3JzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHR0YXJnZXQ6IG51bGwsXG5cdFx0cmVuZGVyVGFnOiAnPGRpdj48L2Rpdj4nLFxuXHRcdHNwbGl0T246ICcsJyxcblx0XHRzcGxpdEludG86ICd2YWx1ZScsXG5cdFx0c3BsaXRCZXR3ZWVuOiAnJyxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5jaGlsZHJlbk9yZGVyLmxlbmd0aCkgeyAvLyBJZiBubyBvcmRlciBpcyBzcGVjaWZpZWQganVzdCB1c2UgdGhlIG9yZGVyIG9mIHRoZSBoYXNoICh3aGljaCB3aWxsIGJlIGFscGhhYmV0aWNhbCBpbiBtb3N0IGNhc2VzIC0gYWxzbyBwcm9iYWJseSB3cm9uZylcblx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IE9iamVjdC5rZXlzKG1lLmNoaWxkcmVuKTtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBjaGlsZHJlbk9yZGVyIHNwZWNpZmllZC4gSW5oZXJpdGluZyBmcm9tIGNoaWxkcmVuIGhhc2ggaW4gaGFzaCBvcmRlciBpbnN0ZWFkJywgbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIW1lLnRhcmdldCkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyX3NwbGl0dGVyPiBObyB0YXJnZXQgc3BlY2lmaWVkIHRvIHdvcmsgd2l0aCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIW1lLnNwbGl0T24pIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdiYXR0X2NvbnRhaW5lcl9zcGxpdHRlcj4gTm8gc3BsaXRPbiBzcGVjaWZpZWQgdG8gd29yayB3aXRoJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHRWYWwgPSBtZS5wYXJzZShtZS50YXJnZXQpO1xuXG5cdFx0XHR2YXIgc3BsaXRzID0gdFZhbC5zcGxpdChtZS5zcGxpdE9uKTtcblx0XHRcdGZvciAodmFyIHMgaW4gc3BsaXRzKSB7XG5cdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRtZS5kYXRhW21lLnNwbGl0SW50b10gPSBzcGxpdHNbc107XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0XHR2YXIgY2hpbGQgPSBtZS5jaGlsZHJlblttZS5jaGlsZHJlbk9yZGVyW2NdXTtcblx0XHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblx0XHRcdFx0XHRtZS5yZW5kZXJSb3cobWUuZWxlbWVudCwgY2hpbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtZS5zcGxpdEJldHdlZW4gJiYgcyA8IHNwbGl0cy5sZW5ndGgtMSlcblx0XHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZChtZS5zcGxpdEJldHdlZW4pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzxkaXYgY2xhc3M9XCJmb3JtLWlubGluZVwiPjwvZGl2PicsXG5cdFx0c2hvd0RhdGU6IHRydWUsXG5cdFx0c2hvd1RpbWU6IHRydWUsXG5cdFx0cmVhZE9ubHk6IGZhbHNlLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmICh0aGlzLnNob3dEYXRlKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCc8ZGl2IGNsYXNzPVwiaW5wdXQtcHJlcGVuZFwiPjxzcGFuIGNsYXNzPVwiYWRkLW9uXCI+PGkgY2xhc3M9XCJpY29uLWNhbGVuZGFyXCI+PC9pPjwvc3Bhbj48aW5wdXQgdHlwZT1cImRhdGVcIiBjbGFzcz1cImlucHV0LW1lZGl1bVwiLz48L2Rpdj4nKTtcblxuXHRcdFx0aWYgKHRoaXMuc2hvd0RhdGUgJiYgdGhpcy5zaG93VGltZSlcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFwcGVuZCgnJm5ic3A7Jyk7XG5cblx0XHRcdGlmICh0aGlzLnNob3dUaW1lKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCc8ZGl2IGNsYXNzPVwiaW5wdXQtcHJlcGVuZFwiPjxzcGFuIGNsYXNzPVwiYWRkLW9uXCI+PGkgY2xhc3M9XCJpY29uLXRpbWVcIj48L2k+PC9zcGFuPjxpbnB1dCB0eXBlPVwidGltZVwiIGNsYXNzPVwiaW5wdXQtc21hbGxcIi8+Jyk7XG5cblx0XHRcdGlmICh0aGlzLnJlYWRPbmx5KVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuZmluZCgnaW5wdXQnKVxuXHRcdFx0XHRcdC5hdHRyKCdyZWFkb25seScsICdyZWFkb25seScpXG5cdFx0XHRcdFx0LmFkZENsYXNzKCdkaXNhYmxlZElucHV0Jyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0Y29udGFpbmVyRHJhdzogJ25vcm1hbCcsXG5cdFx0aW1wbHlDaGlsZDogJ2xpbmsnLFxuXHRcdHRleHQ6ICc8aSBjbGFzcz1cImljb24tYWxpZ24tanVzdGlmeVwiPjwvaT4nLFxuXHRcdGNvbHVtblRpdGxlOiAnJm5ic3A7Jyxcblx0XHRjb2x1bW5XaWR0aDogJzUwcHgnLFxuXHRcdHJlbmRlclRhZzogJzxkaXYgY2xhc3M9XCJkcm9wZG93blwiPjwvZGl2PicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghbWUuY2hpbGRyZW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIgPSBPYmplY3Qua2V5cyhtZS5jaGlsZHJlbik7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gY2hpbGRyZW5PcmRlciBzcGVjaWZpZWQuIEluaGVyaXRpbmcgZnJvbSBjaGlsZHJlbiBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIGRkQnV0dG9uID0gJCgnPGEgY2xhc3M9XCJidG5cIiBkYXRhLXRvZ2dsZT1cImRyb3Bkb3duXCI+JyArIChtZS50ZXh0IHx8IG1lLnRpdGxlKSArICc8L2E+Jylcblx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXG5cdFx0XHR2YXIgZGRJdGVtcyA9ICQoJzx1bCBjbGFzcz1cImRyb3Bkb3duLW1lbnVcIj48L3VsPicpXG5cdFx0XHRcdC5hcHBlbmRUbyhtZS5lbGVtZW50KTtcblxuXHRcdFx0Zm9yICh2YXIgYyBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbY11dO1xuXHRcdFx0XHRpZiAoY2hpbGQudGl0bGUgPT0gJy0nIHx8IGNoaWxkLnRleHQgPT0gJy0nKSB7IC8vIENoaWxkIGlzIGFjdHVhbGx5IGEgc2VwZXJhdG9yXG5cdFx0XHRcdFx0ZGRJdGVtcy5hcHBlbmQoJCgnPGxpIGNsYXNzPVwiZGl2aWRlclwiPjwvbGk+JykpO1xuXHRcdFx0XHR9IGVsc2UgeyAvLyBDaGlsZCBpcyBhIHJlYWwgYm95IVxuXHRcdFx0XHRcdHZhciBjaGlsZFdyYXBwZXIgPSAkKCc8bGk+PC9saT4nKTtcblx0XHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblx0XHRcdFx0XHRjaGlsZFdyYXBwZXIuYXBwZW5kKGNoaWxkLmVsZW1lbnQpO1xuXHRcdFx0XHRcdGRkSXRlbXMuYXBwZW5kKGNoaWxkV3JhcHBlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnNldHVwLmNhbGwodGhpcyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuYXR0cigndHlwZScsICdlbWFpbCcpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zdXBlci5yZW5kZXIuY2FsbCh0aGlzKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHR1cmw6IG51bGwsXG5cdFx0a2V5OiBudWxsLFxuXHRcdG9yZGVyOiBudWxsLFxuXG5cdFx0c2V0OiBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0Y29uc29sZS5sb2coJ0xvYWRlZCBmZWVkIFwiJyArIG1lLmlkICsgJ1wiJyk7XG5cdFx0XHRiYXR0LmZlZWRzW21lLmlkXSA9ICQuZXh0ZW5kKHt9LCBtZSwge2NoaWxkcmVuOiB7fX0pOyAvLyBDbG9uZSB0byBnbG9iYWwgb2JqZWN0IChhbmQgbnVrZSBhbGwgY2hpbGRyZW4gc2luY2Ugd2Ugd2lsbCBiZSBwcm9jZXNzaW5nIHRoZW0gbmV4dCBhbnl3YXkpXG5cdFx0XHQkLmVhY2goanNvbiwgZnVuY3Rpb24oaSwgb2JqKSB7XG5cdFx0XHRcdGJhdHQuZmVlZHNbbWUuaWRdLmFkZENoaWxkKG9iaik7XG5cdFx0XHR9KTtcblx0XHRcdGJhdHQuZmluZChtZS5pZCkucGFyZW50KCkucmVtb3ZlQ2hpbGQobWUuaWQpOyAvLyBSZW1vdmUgc2VsZiBmcm9tIG9iamVjdCBsaXN0c1xuXHRcdH0sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7IC8vIERvIG5vdGhpbmcgLSB0aGlzIGVsZW1lbnQgd2lsbCBiZSByZW1vdmVkIGR1cmluZyBzZXQoKSBhbnl3YXlcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkgeyAvLyBBcyB3aXRoIHNldHVwKCkgd2UgZG9udCBkcmF3IHRoaXMgd2lkZ2V0IGFueXdheVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdGdldERhdGE6IGZ1bmN0aW9uKGRhdGFTb3VyY2UsIHN1Y2Nlc3MsIGZhaWwpIHtcblx0XHRcdGNvbnNvbGUud2FybignYmF0dF9kYl9mZWVkPiBBc2tlZCB0byBnZXQgZGF0YSBidXQgbm8gc3BlY2lmaWMgZHJpdmVyIGlzIHNldHVwJyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0c2V0RGF0YTogZnVuY3Rpb24oZmlsdGVyLCBkYXRhLCBzdWNjZXNzLCBmYWlsKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfZGJfZmVlZD4gQXNrZWQgdG8gc2V0IGRhdGEgYnV0IG5vIHNwZWNpZmljIGRyaXZlciBpcyBzZXR1cCcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJ2YXIgc2ltcGxlSnNvbkZpbHRlciA9IHJlcXVpcmUoJ3NpbXBsZS1qc29uLWZpbHRlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHVybDogJy9iYXR0L2FwaS9mZWVkJyxcblx0XHRrZXk6ICdpZCcsXG5cdFx0b3JkZXI6ICdpZCcsXG5cdFx0dGFibGU6IG51bGwsIC8vIE92ZXJyaWRlIGlmIHRoZSByZW1vdGUgdGFibGUgZG9lc250IG1hdGNoIHRoaXMgb2JqZWN0cyBpZFxuXHRcdGZ1c3N5OiAnYXV0bycsIC8vIEFwcGx5IGZpbHRlcnMgdG8gaW5jb21taW5nIEpTT04gc3RyZWFtIChpLmUuIGRvbnQgdHJ1c3QgdGhlIHNlcnZlciB0byByZXR1cm4gdGhlIHJpZ2h0IGRhdGEpLiBUcnVlLCBmYWxzZSBvciBcImF1dG9cIiAodHJ1ZSBpZiB1cmwgZW5kcyB3aXRoICcuanNvbicpXG5cblx0XHQvKipcblx0XHQqIEluaXRpYWxpemUgYWxsIGNoaWxkIGZpZWxkc1xuXHRcdCogVGhpcyBmdW5jdGlvbiBhbHNvIHJlbG9jYXRlcyB0aGlzIGZpZWxkIGludG8gYmF0dC5mZWVkcyBvdXRzaWRlIG9mIHRoZSB1c3VhbCB0cmVlIHN0cnVjdHVyZVxuXHRcdCovXG5cdFx0c2V0OiBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHRpZiAodGhpcy50YWJsZSlcblx0XHRcdFx0dGhpcy50YWJsZSA9IHRoaXMuaWQ7XG5cdFx0XHR0aGlzLnN1cGVyLnNldC5jYWxsKHRoaXMsIGpzb24pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUmV0cmlldmUgc29tZSBkYXRhIGJhc2VkIG9uIGEgZ2l2ZW4gZmlsdGVyICsgdGhpcy5maWx0ZXJcblx0XHQqIEBwYXJhbSBhcnJheSBmaWx0ZXIgSGFzaCBvZiBmaWx0ZXJzIHRvIHVzZSAoYmFzaWNseSB0aGUgU1FMIFdIRVJFIGNvbmRpdGlvbilcblx0XHQqIEBwYXJhbSBhcnJheSBmaWVsZHMgVGhlIGZpZWxkcyB0byByZXRyaWV2ZVxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uIHN1Y2Nlc3MgVGhlIHN1Y2Nlc3MgY2FsbGJhY2sgZnVuY3Rpb24uIENhbGxlZCB3aXRoIGZ1bmN0aW9uKGpzb24pXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb24gZmFpbCBUaGUgZmFpbGVkIGNhbGxiYWNrIGZ1bmN0aW9uLiBDYWxsZWQgd2l0aCBmdW5jdGlvbihlcnJUZXh0LCBlcnJUaHJvd24pXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdGdldERhdGE6IGZ1bmN0aW9uKGRhdGFTb3VyY2UsIHN1Y2Nlc3MsIGZhaWwpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHQkLmFqYXgoe1xuXHRcdFx0XHR1cmw6IG1lLnVybCxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0dHlwZTogJ1BPU1QnLFxuXHRcdFx0XHRjYWNoZTogZmFsc2UsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246ICdnZXQnLFxuXHRcdFx0XHRcdGtleTogbWUua2V5LFxuXHRcdFx0XHRcdG9yZGVyOiBkYXRhU291cmNlLm9yZGVyIHx8IG1lLm9yZGVyLFxuXHRcdFx0XHRcdHRhYmxlOiBtZS50YWJsZSB8fCBtZS5pZCxcblx0XHRcdFx0XHRqb2luczogJC5leHRlbmQoe30sIG1lLmpvaW5zLCBkYXRhU291cmNlLmpvaW5zKSxcblx0XHRcdFx0XHRmaWx0ZXJzOiAkLmV4dGVuZCh7fSwgbWUuZmlsdGVycywgZGF0YVNvdXJjZS5maWx0ZXJzKSxcblx0XHRcdFx0XHRmaWVsZHM6ICQuZXh0ZW5kKHt9LCBtZS5maWVsZHMsIGRhdGFTb3VyY2UuZmllbGRzKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0KG1lLmZ1c3N5ID09PSB0cnVlKVxuXHRcdFx0XHRcdFx0fHwgKG1lLmZ1c3N5ID09PSAnYXV0bycgJiYgL1xcLmpzb24kLy5leGVjKG1lLnVybCkpIC8vIG1lLmZ1c3N5PT1hdXRvIChhbmQgdGhlIFVSTCBlbmRzIHdpdGggLmpzb24pXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHR2YXIgc2pmID0gbmV3IHNpbXBsZUpzb25GaWx0ZXI7XG5cdFx0XHRcdFx0XHRqc29uLnBheWxvYWQgPSBzamZcblx0XHRcdFx0XHRcdFx0LmZpbHRlcihkYXRhU291cmNlLmZpbHRlcnMpXG5cdFx0XHRcdFx0XHRcdC5kYXRhKGpzb24ucGF5bG9hZClcblx0XHRcdFx0XHRcdFx0LmxpbWl0KGRhdGFTb3VyY2UubGltaXQpXG5cdFx0XHRcdFx0XHRcdC53YW50QXJyYXkoKVxuXHRcdFx0XHRcdFx0XHQuZXhlYygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzdWNjZXNzKGpzb24pO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlcnJvcjogZnVuY3Rpb24oanF4aHIsIGVyclRleHQsIGVyclRocm93bikge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybignRXJyb3Igd2hpbGUgcHVsbGluZyBkYXRhJywgZXJyVGV4dCwgZXJyVGhyb3duKTsgLy8gRklYTUU6IGRlYWwgd2l0aCB0aGlzIGdyYWNlZnVsbHlcblx0XHRcdFx0XHRmYWlsKGVyclRleHQsIGVyclRocm93bik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogU2F2ZSBkYXRhIGJhY2sgdG8gdGhlIEJhdHQgZGF0YSBmZWVkXG5cdFx0KiBAcGFyYW0gYXJyYXkgZmlsdGVyIEhhc2ggb2YgZmlsdGVycyB0byB1c2UgKGJhc2ljbHkgdGhlIFNRTCBXSEVSRSBjb25kaXRpb24pXG5cdFx0KiBAcGFyYW0gYXJyYXkgZmllbGRzIFRoZSBmaWVsZHMgdG8gc2V0IGZvciB0aGUgZ2l2ZW4gZml0bGVyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb24gc3VjY2VzcyBUaGUgc3VjY2VzcyBjYWxsYmFjayBmdW5jdGlvbi4gQ2FsbGVkIHdpdGggZnVuY3Rpb24oanNvbilcblx0XHQqIEBwYXJhbSBmdW5jdGlvbiBmYWlsIFRoZSBmYWlsZWQgY2FsbGJhY2sgZnVuY3Rpb24uIENhbGxlZCB3aXRoIGZ1bmN0aW9uKGVyclRleHQsIGVyclRocm93bilcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoaXMgY2hhaW5hYmxlIG9iamVjdFxuXHRcdCovXG5cdFx0c2V0RGF0YTogZnVuY3Rpb24oZGF0YVNvdXJjZSwgZGF0YSwgc3VjY2VzcywgZmFpbCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdCQuYWpheCh7XG5cdFx0XHRcdHVybDogbWUudXJsLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHR0eXBlOiAnUE9TVCcsXG5cdFx0XHRcdGNhY2hlOiBmYWxzZSxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogJ3NldCcsXG5cdFx0XHRcdFx0a2V5OiBtZS5rZXksXG5cdFx0XHRcdFx0dGFibGU6IG1lLnRhYmxlIHx8IG1lLmlkLFxuXHRcdFx0XHRcdGZpbHRlcnM6IGRhdGFTb3VyY2UuZmlsdGVycyxcblx0XHRcdFx0XHRmaWVsZHM6IGRhdGFcblx0XHRcdFx0fSxcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oanNvbikge1xuXHRcdFx0XHRcdHN1Y2Nlc3MoanNvbik7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVycm9yOiBmdW5jdGlvbihqcXhociwgZXJyVGV4dCwgZXJyVGhyb3duKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKCdFcnJvciB3aGlsZSBzZXR0aW5nIGRhdGEnLCBlcnJUZXh0LCBlcnJUaHJvd24pOyAvLyBGSVhNRTogZGVhbCB3aXRoIHRoaXMgZ3JhY2VmdWxseVxuXHRcdFx0XHRcdGZhaWwoZXJyVGV4dCwgZXJyVGhyb3duKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogJzxpIGNsYXNzPVwiaWNvbi1maWxlXCI+PC9pPiBTZWxlY3QgZmlsZS4uLicsXG5cdFx0Y2xhc3NlczogJ2J0bicsXG5cdFx0dGV4dFVwbG9hZGluZzogJzxpIGNsYXNzPVwiaWNvbi1maWxlIGljb24td2hpdGVcIj48L2k+IHt7dmFsdWV9fScsXG5cdFx0Y2xhc3Nlc1VwbG9hZGluZzogJ2J0biBidG4tc3VjY2VzcycsXG5cdFx0cmVuZGVyVGFnOiAnPGRpdj48ZGl2IHN0eWxlPVwiZGlzcGxheTogbm9uZVwiPjxpbnB1dCB0eXBlPVwiZmlsZVwiLz48L2Rpdj48YT48L2E+PC9kaXY+Jyxcblx0XHRhdXRvRHVwbGljYXRlOiBmYWxzZSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0dmFyIGJ1dHRvbiA9IHRoaXMuZWxlbWVudC5maW5kKCdhJylcblx0XHRcdFx0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGZpbGUudHJpZ2dlcignY2xpY2snKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR2YXIgZmlsZSA9IHRoaXMuZWxlbWVudC5maW5kKCdpbnB1dFt0eXBlPWZpbGVdJylcblx0XHRcdFx0LmF0dHIoJ25hbWUnLCBtZS5pZClcblx0XHRcdFx0Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRtZS5yZW5kZXIoKTtcblx0XHRcdFx0XHRpZiAobWUuYXV0b0R1cGxpY2F0ZSkge1xuXHRcdFx0XHRcdFx0dmFyIGFkZENoaWxkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdC8vIEZJWDogRG9udCBhZGQgYW55IG1vcmUgY2hpbGRyZW4gaWYgdGhlIGxhc3QgaXRlbSBpbiB0aGUgc2VxdWVuY2UgZG9lc24ndCBoYXZlIGEgdmFsdWUgLSBUaGlzIGlzIHRvIGZpeCB0aGUgaXNzdWUgd2hlcmUgY2hhbmdpbmcgYW4gZXhpc3RpbmcgZmlsZSB1cGxvYWQgYm94IHdvdWxkIGtlZXAgYWRkaW5nIGNoaWxkcmVuIHRvIHRoZSBlbmQgb2YgdGhlIGNvbnRhaW5lciBwYXJlbnQge3t7XG5cdFx0XHRcdFx0XHR2YXIgb3JpZ2luYWxFbGVtZW50ID0gbWU7XG5cdFx0XHRcdFx0XHR3aGlsZSAob3JpZ2luYWxFbGVtZW50LmNsb25lT2YpIC8vIFRoaXMgZWxlbWVudCBpcyBhY3R1YWxseSBhIGNsb25lIC0gZmluZCB0aGUgb3JpZ2luYWxcblx0XHRcdFx0XHRcdFx0b3JpZ2luYWxFbGVtZW50ID0gYmF0dC5maW5kKG9yaWdpbmFsRWxlbWVudC5jbG9uZU9mKTtcblxuXHRcdFx0XHRcdFx0dmFyIG15UGFyZW50ID0gbWUucGFyZW50KCk7XG5cdFx0XHRcdFx0XHR2YXIgY2hpbGRyZW4gPSAkLmV4dGVuZChbXSwgbXlQYXJlbnQuY2hpbGRyZW5PcmRlcik7XG5cdFx0XHRcdFx0XHRjaGlsZHJlbi5yZXZlcnNlKCk7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBjIGluIGNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBjaGlsZCA9IG15UGFyZW50LmNoaWxkcmVuW2NoaWxkcmVuW2NdXTtcblx0XHRcdFx0XHRcdFx0aWYgKGNoaWxkLmNsb25lT2YgPT0gb3JpZ2luYWxFbGVtZW50LmlkKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0ZPVU5EIEZJUlNUIENMT05FJywgY2hpbGQuaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGlmICghY2hpbGQudmFsdWUpXG5cdFx0XHRcdFx0XHRcdFx0XHRhZGRDaGlsZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQvLyB9fX1cblx0XHRcdFx0XHRcdGlmIChhZGRDaGlsZClcblx0XHRcdFx0XHRcdFx0bWUucGFyZW50KClcblx0XHRcdFx0XHRcdFx0XHQuYWRkQ2hpbGQoJC5leHRlbmQoe30sIG1lLCB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogYmF0dC5nZXRVbmlxdWVJZChtZS5pZCksXG5cdFx0XHRcdFx0XHRcdFx0XHR2YWx1ZTogbnVsbCxcblx0XHRcdFx0XHRcdFx0XHRcdGNsb25lT2Y6IG9yaWdpbmFsRWxlbWVudC5pZFxuXHRcdFx0XHRcdFx0XHRcdH0pLCAnYWZ0ZXInLCBtZS5pZClcblx0XHRcdFx0XHRcdFx0XHQucmVuZGVyKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdGlmIChmaWxlLnZhbCgpKSB7IC8vIEhhcyBhIGZpbGUgdG8gdXBsb2FkXG5cdFx0XHRcdG1lLnZhbHVlID0gZmlsZS52YWwoKS5yZXBsYWNlKC9cXFxcL2csJy8nKS5yZXBsYWNlKCAvLipcXC8vLCcnKTtcblx0XHRcdFx0YnV0dG9uXG5cdFx0XHRcdFx0Lmh0bWwobWUucGFyc2UobWUudGV4dFVwbG9hZGluZykpXG5cdFx0XHRcdFx0LnJlbW92ZUNsYXNzKG1lLmNsYXNzZXMpXG5cdFx0XHRcdFx0LmFkZENsYXNzKG1lLmNsYXNzZXNVcGxvYWRpbmcpO1xuXHRcdFx0fSBlbHNlIHsgLy8gTm90aGluZyB0byB1cGxvYWQgYnV0IHN0aWxsIGhhcyBzeWxpbmdcblx0XHRcdFx0YnV0dG9uXG5cdFx0XHRcdFx0Lmh0bWwobWUucGFyc2UobWUudGV4dCkpXG5cdFx0XHRcdFx0LnJlbW92ZUNsYXNzKG1lLmNsYXNzZXNVcGxvYWRpbmcpXG5cdFx0XHRcdFx0LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdG1ldGhvZDogJ1BPU1QnLCAvLyBQT1NUIC0gUmVndWxhciBIVE1MIHN1Ym1pdCwgQkFUVCAtIGludGVybmFsIEFKQVggY2FsbHMgdG8gYSBCYXR0IHNlcnZlclxuXHRcdGFjdGlvbjogJz8nLCAvLyBJZiB0eXBlPWh0bWwgdGhpcyBpcyB0aGUgbG9jYXRpb24gd2hlcmUgdGhlIGZvcm0gd2lsbCBiZSBzdWJtaXR0ZWQuXG5cdFx0cmVuZGVyVGFnOiAnPGZvcm0gYWN0aW9uPVwie3t7YWN0aW9ufX19XCIgbWV0aG9kPVwie3ttZXRob2R9fVwiIGNsYXNzPVwiZm9ybS1ob3Jpem9udGFsXCIgZW5jdHlwZT1cIm11bHRpcGFydC9mb3JtLWRhdGFcIj48L2Zvcm0+JyxcblxuXHRcdHN1Ym1pdDogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLnZhbGlkYXRlKCkpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1NVQk1JVD4gT0snKTtcblxuXHRcdFx0XHRzd2l0Y2ggKG1lLm1ldGhvZC50b1VwcGVyQ2FzZSgpKSB7XG5cdFx0XHRcdFx0Y2FzZSAnUE9TVCc6XG5cdFx0XHRcdFx0XHRtZS5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdGlmICghdGhpcy5pZEZha2UpXG5cdFx0XHRcdFx0XHRcdFx0bWUuZWxlbWVudC5hcHBlbmQoJzxpbnB1dCB0eXBlPVwiaGlkZGVuXCIgbmFtZT1cIicgKyB0aGlzLmlkICsgJ1wiIHZhbHVlPVwiJyArICh0aGlzLnZhbHVlICE9PSBudWxsID8gdGhpcy52YWx1ZSA6ICcnKSArICdcIi8+Jyk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ0JBVFQnOlxuXHRcdFx0XHRcdFx0Ly8gR2V0IGFsbCBjaGlsZHJlbiB3aGljaCByZXF1ZXN0IGZyb20gYSBkYXRhU291cmNlIHt7e1xuXHRcdFx0XHRcdFx0dmFyIGRhdGFTb3VyY2VzID0gW107XG5cdFx0XHRcdFx0XHRtZS5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLmRhdGFTb3VyY2UpXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YVNvdXJjZXMucHVzaCh0aGlzKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0Ly8gfX19XG5cdFx0XHRcdFx0XHQvLyBGSVhNRTogQXZvaWQgcGVlcnMgYmVpbmcgaW5zaWRlIHBlZXJzXG5cdFx0XHRcdFx0XHQvLyBGb3IgZWFjaCBkYXRhU291cmNlLi4uIHt7e1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBkYXRhU291cmNlcykge1xuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHt9O1xuXHRcdFx0XHRcdFx0XHR2YXIgZHMgPSAkLmV4dGVuZCh7fSwgZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdC8vIEV2YWx1YXRlIGFsbCBmaWx0ZXJzIHt7e1xuXHRcdFx0XHRcdFx0XHRpZiAoZHMuZmlsdGVycykgeyAvLyBQYXJzZSBhbGwgZmlsdGVyIGFyZ3VtZW50c1xuXHRcdFx0XHRcdFx0XHRcdHZhciBuZXdGaWx0ZXJzID0ge307XG5cdFx0XHRcdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIGRzLmZpbHRlcnMpIHtcblx0XHRcdFx0XHRcdFx0XHRcdG5ld0ZpbHRlcnNba2V5XSA9IG1lLnBhcnNlKGRzLmZpbHRlcnNba2V5XSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGRzLmZpbHRlcnMgPSBuZXdGaWx0ZXJzO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdC8vIH19fVxuXHRcdFx0XHRcdFx0XHRkYXRhU291cmNlc1tpXS5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0XHRcdFx0KHRoaXMuZGF0YUJpbmRpbmcpIC8vIEhhcyBhIGRhdGEgYmluZGluZ1xuXHRcdFx0XHRcdFx0XHRcdFx0JiYgKGJhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXSkgLy8gVGhlIGZlZWQgdGhpcyBpdGVtIGlzIHBvaW50aW5nIGF0IGlzIHZhbGlkXG5cdFx0XHRcdFx0XHRcdFx0XHQmJiAoYmF0dC5mZWVkc1tkYXRhU291cmNlc1tpXS5kYXRhU291cmNlLmZlZWRdLmNoaWxkcmVuW3RoaXMuZGF0YUJpbmRpbmddKSAvLyBUaGUgZmVlZCByZWNvZ25pemVzIHRoaXMgY2hpbGRcblx0XHRcdFx0XHRcdFx0XHRcdCYmIChiYXR0LmZlZWRzW2RhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW5bdGhpcy5kYXRhQmluZGluZ10uYWxsb3dTZXQpIC8vIFRoZSBmZWVkIHNheXMgdGhpcyBjaGlsZCBpdGVtIGNhbiBiZSBzZXRcblx0XHRcdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChiYXR0LmZlZWRzW2RhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW5bdGhpcy5kYXRhQmluZGluZ10uZGF0YUlkKSB7IC8vIFVzZSBhbHRlcm5hdGUgaW50ZXJuYWwgbmFtZSBmb3IgdGhlIGRhdGFJZFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRhW2JhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXS5jaGlsZHJlblt0aGlzLmRhdGFCaW5kaW5nXS5kYXRhSWRdID0gdGhpcy52YWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7IC8vIE5vIGFsdGVybmF0ZSBzcGVjaWZpZWQgLSBqdXN0IHBhc3MgdGhlIElEXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRhdGFbdGhpcy5kYXRhQmluZGluZ10gPSB0aGlzLnZhbHVlO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGJhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXS5zZXREYXRhKGRzLCBkYXRhLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnRklYTUU6IFNBVkVEIScpO1xuXHRcdFx0XHRcdFx0XHR9LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnRklYTUU6IFNBVkUgRkFJTEVEIScpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vIH19fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnQkFUVC1MRUdBQ1knOlxuXHRcdFx0XHRcdFx0dmFyIGRhdGEgPSB7fTtcblx0XHRcdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuZGF0YUJpbmRpbmcpXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YVt0aGlzLmRhdGFCaW5kaW5nXSA9IHRoaXMudmFsdWU7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignQmF0dCBzdWJtaXNzaW9uIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnU0FWRT4nLCBkYXRhKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRhbGVydCgnVW5zdXBwb3J0ZWQgZm9ybSB0eXBlOiAnICsgbWUubWV0aG9kKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1NVQk1JVD4gRkFJTCcpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oZm9ybVBhcmVudCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmVsZW1lbnQgPSAkKG1lLnBhcnNlKG1lLnJlbmRlclRhZykpO1xuXHRcdFx0bWUuZWxlbWVudC5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRtZS5zdWJtaXQuY2FsbChtZSk7XG5cdFx0XHRcdGlmIChtZS5tZXRob2QgPT0gJ0JBVFQnKVxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH0pO1xuXHRcdFx0aWYgKGZvcm1QYXJlbnQpXG5cdFx0XHRcdG1lLmVsZW1lbnQuYXBwZW5kVG8oZm9ybVBhcmVudCk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRpZiAoIW1lLmVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ2JhdHRfZm9ybT4gVG9sZCB0byByZW5kZXIgYnV0IHdpdGggbm8gcGFyZW50IGVsZW1lbnQnLCBtZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bWUuc3VwZXIucmVuZGVyLmNhbGwobWUpO1xuXHRcdFx0bWUuZWFjaENoaWxkKGZ1bmN0aW9uKCkgeyAvLyBDYWxjdWxhdGUgaW5pdGlhbCBzdGF0ZSBvZiBhbGwgc2hvd0lmIGV2ZW50c1xuXHRcdFx0XHR0aGlzLmNoYW5nZU90aGVyKGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdzcGFuJyxcblx0XHR0aXRsZTogJ0EgaGVhZGluZycsXG5cdFx0cmVuZGVyVGFnOiAnPGxlZ2VuZD48L2xlZ2VuZD4nLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5odG1sKHRoaXMudGl0bGUpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdzcGFuJyxcblx0XHR0ZXh0OiAnPGRpdiBjbGFzcz1cImFsZXJ0IGFsZXJ0LWluZm9cIj5IZWxsbyBXb3JsZDwvZGl2PicsXG5cdFx0Y2xhc3NlczogbnVsbCxcblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGh0bWwgPSB0aGlzLnRleHQgfHwgdGhpcy50aXRsZTtcblx0XHRcdGlmIChodG1sLnN1YnN0cigwLCAxKSAhPSAnPCcpIC8vIERvZXNuJ3QgYWxyZWFkeSBoYXZlIGEgdGFnIHN0cnVjdHVyZVxuXHRcdFx0XHRodG1sID0gJzxkaXY+JyArIGh0bWwgKyAnPC9kaXY+JztcblxuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnBhcnNlKGh0bWwpKTtcblxuXHRcdFx0aWYgKHRoaXMuY2xhc3Nlcylcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFkZENsYXNzKHRoaXMuY2xhc3Nlcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0cGxhY2Vob2xkZXI6IG51bGwsXG5cdFx0Y2xhc3NlczogbnVsbCxcblx0XHRyZXF1aXJlZDogZmFsc2UsXG5cdFx0bGVuZ3RoTWF4OiBudWxsLFxuXHRcdGxlbmd0aE1pbjogbnVsbCxcblx0XHRyZWFkT25seTogbnVsbCxcblx0XHRlcnJvclJlcXVpcmVkOiAnU3RyaW5nIHJlcXVpcmVkJyxcblx0XHRlcnJvckxlbmd0aE1heDogJ1N0cmluZyB0b28gbG9uZycsXG5cdFx0ZXJyb3JMZW5ndGhNaW46ICdTdHJpbmcgdG9vIHNob3J0JyxcblxuXHRcdGNoYW5nZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnZhbHVlID0gdGhpcy5lbGVtZW50LnZhbCgpO1xuXHRcdFx0dGhpcy5zdXBlci5jaGFuZ2UuY2FsbCh0aGlzKTtcblx0XHR9LFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lXG5cdFx0XHRcdC5lbGVtZW50ID0gJCgnPGlucHV0Lz4nKVxuXHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLmNoYW5nZS5jYWxsKG1lKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gbWU7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLnZhbHVlKVxuXHRcdFx0XHRtZS5lbGVtZW50LmF0dHIoJ3ZhbHVlJywgbWUudmFsdWUpO1xuXHRcdFx0aWYgKG1lLnBsYWNlaG9sZGVyKVxuXHRcdFx0XHRtZS5lbGVtZW50LmF0dHIoJ3BsYWNlaG9sZGVyJywgbWUucGxhY2Vob2xkZXIpO1xuXHRcdFx0aWYgKG1lLnJlYWRPbmx5KVxuXHRcdFx0XHRtZS5lbGVtZW50XG5cdFx0XHRcdFx0LmF0dHIoJ3JlYWRvbmx5JywgJ3JlYWRvbmx5Jylcblx0XHRcdFx0XHQuYWRkQ2xhc3MoJ2Rpc2FibGVkSW5wdXQnKTtcblx0XHRcdGlmIChtZS5kYXRhQmluZGluZylcblx0XHRcdFx0bWUuZWxlbWVudC5hdHRyKCdiYXR0LWRhdGEtYmluZGluZycsIG1lLmRhdGFCaW5kaW5nKTtcblx0XHRcdGlmIChtZS5jbGFzc2VzKVxuXHRcdFx0XHRtZS5lbGVtZW50LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXHRcdFx0cmV0dXJuIG1lO1xuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAodGhpcy5yZXF1aXJlZCAmJiAhdGhpcy52YWx1ZSlcblx0XHRcdFx0cmV0dXJuIHRoaXMuZXJyb3JSZXF1aXJlZDtcblx0XHRcdGlmICh0aGlzLmxlbmd0aE1heCAmJiB0aGlzLnZhbHVlLmxlbmd0aCA+IHRoaXMubGVuZ3RoTWF4KVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvckxlbmd0aE1heDtcblx0XHRcdGlmICh0aGlzLmxlbmd0aE1pbiAmJiB0aGlzLnZhbHVlLmxlbmd0aCA+IHRoaXMubGVuZ3RoTWluKVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvckxlbmd0aE1pbjtcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogbnVsbCxcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblx0XHRjbGFzc2VzOiBudWxsLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCgnPGxhYmVsIGNsYXNzPVwiY2hlY2tib3hcIj48L2xhYmVsPicpOyAvLyBPZGQgdGhhdCBCb290c3RyYXAgaGFzIG5vIG90aGVyIHdheSBvZiBoYXZpbmcgbm9uLXdlaXJkIGxvb2tpbmcgZm9ybSB0ZXh0XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5lbGVtZW50Lmh0bWwobWUucGFyc2UobWUudGV4dCB8fCBtZS50aXRsZSB8fCAnQSBsYWJlbCcpKTtcblx0XHRcdFxuXHRcdFx0aWYgKG1lLmNsYXNzZXMpXG5cdFx0XHRcdG1lLmVsZW1lbnQuYWRkQ2xhc3MobWUuY2xhc3Nlcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogbnVsbCxcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblx0XHRhY3Rpb246ICdub3RoaW5nJyxcblx0XHRjbGFzc2VzOiBudWxsLFxuXHRcdGljb246IG51bGwsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKCc8YT48L2E+Jyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHR2YXIgYWN0aW9uID0gbWUucGFyc2UobWUuYWN0aW9uKTtcblx0XHRcdG1lLmVsZW1lbnRcblx0XHRcdFx0Lmh0bWwobWUucGFyc2UobWUudGV4dCB8fCBtZS50aXRsZSB8fCAnQSBsaW5rJykpXG5cdFx0XHRcdC5hdHRyKCdocmVmJywgYWN0aW9uKTtcblxuXHRcdFx0aWYgKG1lLmljb24pXG5cdFx0XHRcdG1lLmVsZW1lbnQucHJlcGVuZCgnPGkgY2xhc3M9XCInICsgbWUuaWNvbiArICdcIj48L2k+Jyk7XG5cdFx0XHRcblx0XHRcdGlmIChtZS5jbGFzc2VzKVxuXHRcdFx0XHRtZS5lbGVtZW50LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXG5cdFx0XHRzd2l0Y2ggKGFjdGlvbikge1xuXHRcdFx0XHRjYXNlICdub3RoaW5nJzpcblx0XHRcdFx0XHRtZS5lbGVtZW50LmNsaWNrKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0YWxlcnQoJ05vIGFjdGlvbiBpcyBhc3NpZ25lZCB0byB0aGlzIGJ1dHRvbicpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdzYXZlJzpcblx0XHRcdFx0Y2FzZSAnc3VibWl0Jzpcblx0XHRcdFx0XHRtZS5lbGVtZW50LmNsaWNrKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0bWUuZmluZFBhcmVudCgnZm9ybScpLmVsZW1lbnQudHJpZ2dlcignc3VibWl0Jyk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6IC8vIEFzc2lnbiBhcyBocmVmIGxpbmtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmF0dHIoJ2hyZWYnLCBhY3Rpb24pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtYXg6IG51bGwsXG5cdFx0ZGVjaW1hbHM6IDAsXG5cdFx0ZXJyb3JNaW46ICdOdW1iZXIgdG9vIHNtYWxsJyxcblx0XHRlcnJvck1heDogJ051bWJlciB0b28gbGFyZ2UnLFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc3VwZXIucmVuZGVyLmNhbGwodGhpcyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuYXR0cigndHlwZScsICdudW1iZXInKTtcblx0XHRcdGlmICh0aGlzLmRlY2ltYWxzKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXR0cignc3RlcCcsICdhbnknKTtcblx0XHRcdGlmICh0aGlzLm1pbilcblx0XHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ21pbicsIHRoaXMubWluKTtcblx0XHRcdGlmICh0aGlzLm1heClcblx0XHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ21heCcsIHRoaXMubWF4KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnZhbGlkYXRlLmNhbGwodGhpcyk7XG5cdFx0XHRpZiAodGhpcy5taW4gJiYgdGhpcy52YWx1ZSA8IHRoaXMubWluKVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvck1pbjtcblx0XHRcdGlmICh0aGlzLm1heCAmJiB0aGlzLnZhbHVlID4gdGhpcy5tYXgpXG5cdFx0XHRcdHJldHVybiB0aGlzLmVycm9yTWF4O1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRpZDogbnVsbCxcblx0XHRkYXRhSWQ6IG51bGwsIC8vIElmIHRoZSBpbnRlcm5hbCBzdG9yYWdlIHJlZmVycyB0byB0aGUgZmllbGQgYnkgYW5vdGhlciBuYW1lIC0gc3BlY2lmeSBpdCBoZXJlXG5cdFx0dmFsdWU6IG51bGwsXG5cdFx0ZGVmYXVsdDogbnVsbCxcblx0XHRlbGVtZW50OiBudWxsLFxuXHRcdGNvbnRhaW5lckRyYXc6ICd3aXRoLWxhYmVsJyxcblx0XHR1c2VzOiBudWxsLFxuXHRcdHNob3dJZjogbnVsbCxcblxuXHRcdC8vIER1bW15IGZ1bmN0aW9uc1xuXHRcdHZhbGlkYXRlOiBmdW5jdGlvbigpIHsgcmV0dXJuOyB9LFxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9LFxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0sXG5cdFx0Y2xlYXJEYXRhOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0sXG5cblx0XHRsb2FkRGF0YTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAodGhpcy52YWx1ZSkgLy8gV2UgYWxyZWFkeSBoYXZlIGEgdmFsdWVcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cblx0XHRcdGlmICh0aGlzLmRhdGEgJiYgdGhpcy5kYXRhW3RoaXMuaWRdKSB7IC8vIElzIHRoZXJlIGFueXRoaW5nIGluIHRoZSBkYXRhIHN0cmVhbT9cblx0XHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZGF0YVt0aGlzLmlkXTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5kZWZhdWx0KSB7IC8vIElzIHRoZXJlIGEgZGVmYXVsdCB2YWx1ZT9cblx0XHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZGVmYXVsdDtcblx0XHRcdH0gZWxzZSB7IC8vIEZvdW5kIG5vdGhpbmcgLSBzZXQgdG8gbnVsbFxuXHRcdFx0XHR0aGlzLnZhbHVlID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIExvY2F0ZSB0aGUgcGFyZW50IG9mIHRoZSBjdXJyZW50IEJhdHQgb2JqZWN0IGFuZCByZXR1cm4gZWl0aGVyIHRoZSBzdGFjayBvZiBhbGwgcGFyZW50cyAoZ3JhbmQtcGFyZW50cyBldGMuKSBvciBhIHNwZWNpZmljIHR5cGVcblx0XHQqIEJlY2F1c2Ugb2YgaGFzaC1vZi1oYXNoZXMgc3RydWN0dXJlIEJhdHQgdXNlcyB0byBzdGFzaCBpdHMgb2JqZWN0cyB0aGlzIGZ1bmN0aW9uIGRvZXMgYSB0b3AtZG93biBzZWFyY2ggb2YgYWxsIGZvcm1zIGFuZCBhbGwgY2hpbGRyZW4gdW50aWwgaXQgaGl0cyB0aGUgY3VycmVudCBpZCwgaXQgdGhlbiBidWJibGVzIHVwIGFzIGEgcmV0dXJuIHZhbHVlIHRvIGZpbmQgdGhlIHN0YWNrIG9mIGFsbCBwYXJlbnRzXG5cdFx0KiBAcGFyYW0gc3RyaW5nIHR5cGUgT3B0aW9uYWwgdHlwZSB0byBsaW1pdCBvdXJzZWx2ZXMgdG8uIElmIHNwZWNpZmllZCB0aGUgcmV0dXJuIHdpbGwgZWl0aGVyIGJlIHRoZSBmaXJzdCB3aWRnZXQgbWF0Y2hpbmcgdGhlIHR5cGUgT1IgbnVsbFxuXHRcdCogQHJldHVybiBvYmplY3R8bnVsbHxhcnJheSBJZiB0eXBlIGlzIHNwZWNpZmllZCB0aGUgZmlyc3Qgb2JqZWN0IG1hdGNoaW5nIHRoZSB0eXBlIE9SIG51bGwsIGlmIHVuc3BlY2lmaWVkIGFuIGFycmF5IG9mIGFsbCBwYXJlbnRzXG5cdFx0Ki9cblx0XHRmaW5kUGFyZW50OiBmdW5jdGlvbih0eXBlKSB7XG5cdFx0XHR2YXIgZmluZFBhcmVudFdvcmtlciA9IGZ1bmN0aW9uKGlkLCBjb250ZXh0LCBzdGFjaykge1xuXHRcdFx0XHRpZiAoIWNvbnRleHQuY2hpbGRyZW4pXG5cdFx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRcdGlmIChjb250ZXh0LmNoaWxkcmVuW2lkXSkge1xuXHRcdFx0XHRcdHN0YWNrLnB1c2goY29udGV4dC5jaGlsZHJlbltpZF0pO1xuXHRcdFx0XHRcdHN0YWNrLnB1c2goY29udGV4dCk7XG5cdFx0XHRcdFx0cmV0dXJuIHN0YWNrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yICh2YXIgYyBpbiBjb250ZXh0LmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0dmFyIGZvdW5kID0gZmluZFBhcmVudFdvcmtlcihpZCwgY29udGV4dC5jaGlsZHJlbltjXSwgc3RhY2spO1xuXHRcdFx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRcdFx0c3RhY2sucHVzaChjb250ZXh0KTtcblx0XHRcdFx0XHRcdHJldHVybiBzdGFjaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXG5cdFx0XHRmb3IgKHZhciBiIGluIGJhdHQuZm9ybXMpIHtcblx0XHRcdFx0dmFyIHN0YWNrID0gZmluZFBhcmVudFdvcmtlcih0aGlzLmlkLCBiYXR0LmZvcm1zW2JdLCBbXSk7XG5cdFx0XHRcdGlmIChzdGFjaykge1xuXHRcdFx0XHRcdGlmICh0eXBlKSB7IC8vIExvb2tpbmcgZm9yIGEgc3BlY2lmaWMgdHlwZVxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgcCBpbiBzdGFjaylcblx0XHRcdFx0XHRcdFx0aWYgKHN0YWNrW3BdLnR5cGUgPT0gdHlwZSlcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gc3RhY2tbcF07XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBzdGFjay5zbGljZSgxKTtcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBDb252ZW5pZW5jZSB3cmFwcGVyIGZvciBjYWxsaW5nIHBhcmVudHMoKSBhbmQgdXNpbmcgb25seSB0aGUgZmlyc3QgaXRlbSBvZiB0aGUgYXJyYXlcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoZSBwYXJlbnQgKGEgY29udGFpbmVyKSBvZiB0aGUgY3VycmVudCBvYmplY3Rcblx0XHQqL1xuXHRcdHBhcmVudDogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgcGFyZW50cyA9IHRoaXMuZmluZFBhcmVudC5jYWxsKHRoaXMpO1xuXHRcdFx0cmV0dXJuIHBhcmVudHNbMF07XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUnVuIGEgY2FsbGJhY2sgb3ZlciBlYWNoIHBhcmVudCBvZiB0aGUgY3VycmVudCBvYmplY3Rcblx0XHQqIFRoaXMgZnVuY3Rpb24gaXMgcmVjdXJzaXZlLiBJZiB5b3UgcmVxdWlyZSBqdXN0IHRoZSBpbW1lZGlhdGUgcGFyZW50cyB1c2Ugb2JqZWN0LnBhcmVudCgpXG5cdFx0KiBUaGlzIGlzIHRoZSBtaXJyb3IgZnVuY3Rpb24gb2YgZWFjaENoaWxkKClcblx0XHQqIEBwYXJhbSBjYWxsYmFjayBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuLiBDYWxsZWQgaW4gdGhlIGZvcm1hdCBmdW5jdGlvbigpIHt9IHNldHRpbmcgJ3RoaXMnIHRvIHRoZSBjdXJyZW50IGNvbnRleHRcblx0XHQqIEBwYXJhbSBoYXNoIG9wdGlvbnMgQSBoYXNoIG9mIG9wdGlvbnMgdG8gdXNlIHdoZW4gZmlsdGVyaW5nXG5cdFx0KiBAcGFyYW0gb2JqZWN0IG9iamVjdCBDb250ZXh0IG9iamVjdCAoaW50ZXJuYWwgdXNlIG9ubHkpXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdGVhY2hQYXJlbnQ6IGZ1bmN0aW9uKGNhbGxiYWNrLCBvcHRpb25zLCBjb250ZXh0KSB7XG5cdFx0XHRpZiAoIWNvbnRleHQpXG5cdFx0XHRcdGNvbnRleHQgPSB0aGlzO1xuXG5cdFx0XHR2YXIgc2V0dGluZ3MgPSAkLmV4dGVuZCh7fSwge1xuXHRcdFx0XHRhbmRTZWxmOiBmYWxzZVxuXHRcdFx0fSwgb3B0aW9ucyk7XG5cblx0XHRcdGlmIChzZXR0aW5ncy5hbmRTZWxmKVxuXHRcdFx0XHRjYWxsYmFjay5jYWxsKGNvbnRleHQpO1xuXG5cdFx0XHR2YXIgbm9kZXMgPSB0aGlzLmZpbmRQYXJlbnQoKTtcblx0XHRcdGZvciAodmFyIHBpZCBpbiBub2Rlcykge1xuXHRcdFx0XHR2YXIgbm9kZSA9IG5vZGVzW3BpZF07XG5cdFx0XHRcdGNhbGxiYWNrLmNhbGwobm9kZSk7XG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUGFyc2UgYSBNdXN0YWNoZSB0ZW1wbGF0ZSBhZ2FpbnN0IHRoZSBjdXJyZW50IG9iamVjdFxuXHRcdCogVGhpcyBpcyByZWFsbHkganVzdCBhIGhlbHBlciBmb3IgdGhlIGNvcmUgYmF0dC5wYXJzZSgpIGZ1bmN0aW9uXG5cdFx0KiBAcGFyYW0gc3RyaW5nIHN0cmluZyBUaGUgc3RyaW5nIHRvIHBhcnNlIGFuZCByZXR1cm5cblx0XHQqIEBwYXJhbSBvYmplY3QgZGF0YSBBZGRpdGlvbmFsIGRhdGEgdG8gcGFzcyB0byB0aGUgcGFyc2UgZnVuY3Rpb25cblx0XHQqIEByZXR1cm4gc3RyaW5nIFRoZSBwYXJzZWQgc3RyaW5nXG5cdFx0Ki9cblx0XHRwYXJzZTogZnVuY3Rpb24oc3RyaW5nLCBkYXRhKSB7XG5cdFx0XHRyZXR1cm4gYmF0dC5wYXJzZShzdHJpbmcsIGRhdGEgPyAkLmV4dGVuZCh7fSwgdGhpcywgZGF0YSkgOiB0aGlzKTtcblx0XHR9LFxuXG5cdFx0Y2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHQvLyBUcmlnZ2VyIHRoZSBjaGFuZ2VPdGhlciBldmVudCBvbiBhbGwgb3RoZXIgaXRlbXNcblx0XHRcdG1lXG5cdFx0XHRcdC5maW5kUGFyZW50KCdmb3JtJylcblx0XHRcdFx0LmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5pZCAhPSBtZS5pZClcblx0XHRcdFx0XHRcdHRoaXMuY2hhbmdlT3RoZXIuY2FsbCh0aGlzLCB0cnVlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Y2hhbmdlT3RoZXI6IGZ1bmN0aW9uKHVzZXJDaGFuZ2VkKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLnNob3dJZikge1xuXHRcdFx0XHR2YXIgc2hvdztcblx0XHRcdFx0LyoqXG5cdFx0XHRcdCogV2UgZm91bmQgYSBzaG93SWYgaGFzaCBvYmplY3QuXG5cdFx0XHRcdCogVGhlc2UgdXN1YWxseSBsb29rIGxpa2U6XG5cdFx0XHRcdCpcblx0XHRcdFx0Klx0e2ZvbzogJ2JhcicsIGJhejogJ3F1eid9IC8vIE9ubHkgc2hvdyBpZiBmb289YmFyIEFORCBiYXo9cXV6XG5cdFx0XHRcdCpcdHsnZm9vIGlzJzogJ2VtcHR5J30gLy8gT25seSBzaG93IG9iamVjdCAnZm9vJyBoYXMgbm8gY2hpbGRyZW4gKGFsc28gYXBwbGljYWJsZTogJ2VtcHR5JywgJ25vZGF0YScsICdubyBkYXRhJylcblx0XHRcdFx0Klx0eydmb28gaXMnOiAnZW1wdHknfSAvLyBPbmx5IHNob3cgb2JqZWN0ICdmb28nIGhhcyBTT01FIGNoaWxkcmVuIChhbHNvIGFwcGxpY2FibGU6ICdjaGlsZHJlbicsICdkYXRhJywgJ25vdCBlbXB0eScsICdub3RlbXB0eScpXG5cdFx0XHRcdCpcblx0XHRcdFx0KiBOT1RFOiAnaXMnIGFuZCAnaGFzJyBhcmUgaW50ZXJjaGFuZ2FibGUgaW4gdGhlIGFib3ZlIHN5bnRheC4gU28geydmb28gaGFzJzogJ25vIGNoaWxkcmVuJ30gaXMgdGhlIHNhbWUgYXMgeydmb28gaXMnOiAnZW1wdHknfVxuXHRcdFx0XHQqXG5cdFx0XHRcdCovXG5cdFx0XHRcdGlmICh0eXBlb2YgbWUuc2hvd0lmID09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0dmFyIGZvcm0gPSBtZS5maW5kUGFyZW50KCdmb3JtJyk7XG5cdFx0XHRcdFx0c2hvdyA9IDE7XG5cdFx0XHRcdFx0Zm9yICh2YXIgZmllbGQgaW4gbWUuc2hvd0lmKSB7IC8vIEN5Y2xlIHRob3VnaCBhbGwgZmllbGRzIHVudGlsIHdlIGZpbmQgc29tZXRoaW5nIHRoYXQgRE9FU05UIG1hdGNoXG5cdFx0XHRcdFx0XHR2YXIgbWF0Y2hlcztcblx0XHRcdFx0XHRcdGlmIChtYXRjaGVzID0gL14oLiopICg/OmlzfGhhcykkLy5leGVjKGZpZWxkKSkgeyAvLyBVc2VzICdpcycgc3ludGF4XG5cdFx0XHRcdFx0XHRcdHZhciBvYmpcblx0XHRcdFx0XHRcdFx0c3dpdGNoIChtZS5zaG93SWZbZmllbGRdKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y2FzZSAnY2hpbGRyZW4nOlxuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2RhdGEnOlxuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ25vdGVtcHR5Jzpcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdub3QgZW1wdHknOlxuXHRcdFx0XHRcdFx0XHRcdFx0b2JqID0gZm9ybS5maW5kKG1hdGNoZXNbMV0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKCFvYmouY2hpbGRyZW4gfHwgIU9iamVjdC5rZXlzKG9iai5jaGlsZHJlbikubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHNob3cgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ25vIGRhdGEnOlxuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ25vZGF0YSc6XG5cdFx0XHRcdFx0XHRcdFx0Y2FzZSAnZW1wdHknOlxuXHRcdFx0XHRcdFx0XHRcdFx0b2JqID0gZm9ybS5maW5kKG1hdGNoZXNbMV0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKG9iai5jaGlsZHJlbiAmJiBPYmplY3Qua2V5cyhvYmouY2hpbGRyZW4pLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0c2hvdyA9IDA7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignVW5rbm93biBxdWVyeSBzeW50YXg6JywgZmllbGQsICc9JywgIG1lLnNob3dJZltmaWVsZF0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKG1lLnNob3dJZltmaWVsZF0gIT0gZm9ybS5maW5kKGZpZWxkKS52YWx1ZSkgeyAvLyBTdGFuZGFyZCBrZXk9dmFsXG5cdFx0XHRcdFx0XHRcdHNob3cgPSAwO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIG1lLnNob3dJZiA9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0c2hvdyA9IG1lLnNob3dJZi5jYWxsKG1lKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG1lLnNob3coc2hvdywgdXNlckNoYW5nZWQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNob3c6IGZ1bmN0aW9uKHZpc2libGUsIGFuaW1hdGUpIHtcblx0XHRcdGlmICh2aXNpYmxlIHx8IHZpc2libGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAoYW5pbWF0ZSkge1xuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5zbGlkZURvd24oKTtcblx0XHRcdFx0fSBlbHNlIFxuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoYW5pbWF0ZSkge1xuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5zbGlkZVVwKCk7XG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Ly8gVGhpcyBpcyByZWFsbHkganVzdCBhIGR1bWIgYWxpYXMgZm9yIHNob3coMClcblx0XHRoaWRlOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnNob3coZmFsc2UpO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFJ1biBhIGNhbGxiYWNrIGZ1bmN0aW9uIGlmIGl0IGV4aXN0c1xuXHRcdCogQHBhcmFtIHN0cmluZyBuYW1lIHRoZSBuYW1lIG9mIHRoZSBmdW5jdGlvbiAoZS5nLiBpZiAnZm9vJyB0aGUgZnVuY3Rpb24gY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgJ29uRm9vJylcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoaXMgY2hhaW5hYmxlIG9iamVjdFxuXHRcdCovXG5cdFx0dHJpZ2dlcjogZnVuY3Rpb24obmFtZSkge1xuXHRcdFx0dmFyIGZ1bmNOYW1lID0gJ29uJyArIG5hbWUuc3Vic3RyKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnN1YnN0cigxKTtcblx0XHRcdGlmICh0eXBlb2YgdGhpc1tmdW5jTmFtZV0gPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHR0aGlzW2Z1bmNOYW1lXS5jYWxsKHRoaXMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdub3JtYWwnLFxuXG5cdFx0cmVuZGVyVGFnOiAnPHNlbGVjdD48L3NlbGVjdD4nLFxuXHRcdHJlbmRlckl0ZW06ICc8b3B0aW9uIHZhbHVlPVwie3tkYXRhLl9pZH19XCI+e3tkYXRhLnRpdGxlfX08L29wdGlvbj4nLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmVsZW1lbnQgPSAkKG1lLnJlbmRlclRhZyk7XG5cdFx0XHRtZS5lbGVtZW50Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0bWUudmFsdWUgPSAkKHRoaXMpLnZhbCgpO1xuXHRcdFx0XHRtZS5jaGFuZ2UuY2FsbChtZSk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmxvYWRDb250YWluZXJEYXRhKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZGF0YTtcblx0XHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpXG5cdFx0XHRcdG1lLnJld2luZERhdGEoKTtcblxuXHRcdFx0XHR3aGlsZSAoZGF0YSA9IG1lLmdldERhdGEoKSkge1xuXHRcdFx0XHRcdG1lLmVsZW1lbnQuYXBwZW5kKCQobWUucGFyc2UobWUucmVuZGVySXRlbSkpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtZS52YWx1ZSkge1xuXHRcdFx0XHRcdG1lLmVsZW1lbnQudmFsKG1lLnZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIHsgLy8gTm8gdmFsdWUgLSBzZWxlY3QgdGhlIGZpcnN0XG5cdFx0XHRcdFx0bWUuZWxlbWVudFxuXHRcdFx0XHRcdFx0LnZhbCggbWUuZWxlbWVudC5maW5kKCdvcHRpb246Zmlyc3QnKS5hdHRyKCd2YWx1ZScpIClcblx0XHRcdFx0XHRcdC50cmlnZ2VyKCdjaGFuZ2UnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zdXBlci5zZXR1cC5jYWxsKHRoaXMpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ3R5cGUnLCAndGV4dCcpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zdXBlci5yZW5kZXIuY2FsbCh0aGlzKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb2x1bW5zOiB7fSwgLy8gV2hlcmUgdGhlIHJhdyBvYmplY3RzIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIGNoaWxkcmVuIHJlc2lkZVxuXHRcdGNvbHVtbk9yZGVyOiBbXSxcblxuXHRcdHJlbmRlclRhZzogJzx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLWJvcmRlcmVkIHRhYmxlLXN0cmlwZWRcIj48L3RhYmxlPicsXG5cblx0XHRhdXRvSGlkZTogdHJ1ZSxcblxuXHRcdHJlZnJlc2g6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5jb2x1bW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNvbHVtbk9yZGVyID0gT2JqZWN0LmtleXMobWUuY29sdW1ucyk7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybignTm8gY29sdW1uT3JkZXIgc3BlY2lmaWVkLiBJbmhlcml0aW5nIGZyb20gY29sdW1ucyBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFtZS5lbGVtZW50KVxuXHRcdFx0XHRtZS5lbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cIndlbGxcIj48aDM+TG9hZGluZyB0YWJsZS4uLjwvaDM+PC9kaXY+Jyk7XG5cblx0XHRcdGlmICghbWUuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnYmF0dF90YWJsZT4gTm8gZGF0YVNvdXJjZSBzcGVjaWZpZWQgLSBXaGF0IGRpZCB5b3Ugd2FudCBtZSB0byByZW5kZXIgZXhhY3RseT8nLCBtZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZS5sb2FkQ29udGFpbmVyRGF0YShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHQvLyBLaWxsIGFsbCBjaGlsZHJlbiBhbmQgcmVnZW5lcmF0ZVxuXHRcdFx0XHRcdG1lLmNoaWxkcmVuID0ge307XG5cdFx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IFtdO1xuXG5cdFx0XHRcdFx0dmFyIGRhdGE7XG5cdFx0XHRcdFx0d2hpbGUgKGRhdGEgPSBtZS5nZXREYXRhKCkpIHtcblx0XHRcdFx0XHRcdHZhciByb3dJZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2JhdHQtdGFibGUtcm93LScpO1xuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5bcm93SWRdID0gYmF0dC5tYWtlT2JqZWN0KCdjb250YWluZXInKTtcblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuW3Jvd0lkXS5yZW5kZXJUYWcgPSAnPHRyPjwvdHI+Jztcblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIucHVzaChyb3dJZCk7XG5cblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuW3Jvd0lkXS5zZXQobWUuY29sdW1ucyk7IC8vIENvcHkgY29sdW1uIHByb3RvdHlwZSBpbnRvIG5ldyBjaGlsZFxuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuW3Jvd0lkXS5jaGlsZHJlbikge1xuXHRcdFx0XHRcdFx0XHRtZS5jaGlsZHJlbltyb3dJZF0uY2hpbGRyZW5bY10uY29udGFpbmVyRHJhdyA9ICd0YWJsZS1jZWxsJztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5bcm93SWRdLmVhY2hDaGlsZChmdW5jdGlvbigpIHsgLy8gQ29weSBkYXRhIGhhc2ggaW50byBjaGlsZHJlblxuXHRcdFx0XHRcdFx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHRcdFx0bWUuY2hhbmdlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0dmFyIHJlZHJhdyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRtZS5lbGVtZW50LmVtcHR5KCk7XG5cdFx0XHRcdG1lLnNob3coKTtcblx0XHRcdFx0aWYgKG1lLmNoaWxkcmVuT3JkZXIubGVuZ3RoKSB7IC8vIEhhcyBjaGlsZHJlblxuXHRcdFx0XHRcdHZhciB0YWJsZUhlYWQgPSAkKCc8dHI+PC90cj4nKVxuXHRcdFx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY29sdW1uT3JkZXIpIHtcblx0XHRcdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNvbHVtbnNbbWUuY29sdW1uT3JkZXJbY11dO1xuXHRcdFx0XHRcdFx0dmFyIHRhYmxlQ2VsbCA9ICQoJzx0aD4nICsgKGNoaWxkLmNvbHVtblRpdGxlIHx8IGNoaWxkLnRpdGxlIHx8ICcmbmJzcDsnKSArICc8L3RoPicpXG5cdFx0XHRcdFx0XHRcdC5hcHBlbmRUbyh0YWJsZUhlYWQpO1xuXHRcdFx0XHRcdFx0aWYgKGNoaWxkLmNvbHVtbldpZHRoKVxuXHRcdFx0XHRcdFx0XHR0YWJsZUNlbGwuYXR0cignd2lkdGgnLCBjaGlsZC5jb2x1bW5XaWR0aCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bWUucmV3aW5kRGF0YSgpO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdFx0XHRjaGlsZC5sb2FkRGF0YSgpO1xuXHRcdFx0XHRcdFx0Y2hpbGQuc2V0dXAoKTtcblx0XHRcdFx0XHRcdGNoaWxkLnJlbmRlcigpO1xuXHRcdFx0XHRcdFx0Y2hpbGQuZWxlbWVudC5hcHBlbmRUbyhtZS5lbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAobWUuYXV0b0hpZGUpIHsgLy8gTm8gZGF0YSAtIGhpZGUgdGhlIGVsZW1lbnQgYXV0b21hdGljYWxseT9cblx0XHRcdFx0XHRtZS5oaWRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpZiAobWUuY2hpbGRyZW4ubGVuZ3RoKSB7IC8vIEFscmVhZHkgaGFzIGNoaWxkcmVuIC0gbm8gbmVlZCB0byByZWRyYXdcblx0XHRcdFx0cmVkcmF3KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZS5yZWZyZXNoKHJlZHJhdyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0ZGVmYXVsdDogMCwgLy8gVGhlIGRlZmF1bHQgdGFiIG9mZnNldCB0byBzZWxlY3Rcblx0XHRyZW5kZXJUYWc6ICc8ZGl2PjwvZGl2PicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghbWUuY2hpbGRyZW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIgPSBPYmplY3Qua2V5cyhtZS5jaGlsZHJlbik7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gY2hpbGRyZW5PcmRlciBzcGVjaWZpZWQuIEluaGVyaXRpbmcgZnJvbSBjaGlsZHJlbiBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpO1xuXG5cdFx0XHQvLyBEcmF3IHRhYiBzZWxlY3Rpb24gcGFuZSB7e3tcblx0XHRcdHZhciB0YWJIZWFkID0gJCgnPHVsIGNsYXNzPVwibmF2IG5hdi10YWJzXCI+PC91bD4nKVxuXHRcdFx0XHQuYXBwZW5kVG8obWUuZWxlbWVudCk7XG5cdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdGNoaWxkLmxpbmtIYXNoID0gYmF0dC5zYWZlU3RyaW5nKGNoaWxkLnRpdGxlKTtcblx0XHRcdFx0dGFiSGVhZC5hcHBlbmQoJzxsaT48YSBocmVmPVwiIycgKyBjaGlsZC5saW5rSGFzaCArICdcIiBkYXRhLXRvZ2dsZT1cInRhYlwiPicgKyBjaGlsZC50aXRsZSArICc8L2E+PC9saT4nKTtcblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXHRcdFx0Ly8gRHJhdyBhY3R1YWwgdGFicyB7e3tcblx0XHRcdHZhciB0YWJCb2R5ID0gJCgnPGRpdiBjbGFzcz1cInRhYi1jb250ZW50XCI+PC9kaXY+Jylcblx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXHRcdFx0Zm9yICh2YXIgYyBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbY11dO1xuXHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblx0XHRcdFx0dmFyIHRhYkNvbnRlbnQgPSAkKCc8ZGl2IGNsYXNzPVwidGFiLXBhbmVcIiBpZD1cIicgKyBjaGlsZC5saW5rSGFzaCArICdcIj48L2Rpdj4nKVxuXHRcdFx0XHRcdC5hcHBlbmRUbyh0YWJCb2R5KTtcblx0XHRcdFx0bWUucmVuZGVyUm93KHRhYkNvbnRlbnQsIGNoaWxkKTtcblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXHRcdFx0Ly8gU2VsZWN0IGRlZmF1bHQgdGFiIHt7e1xuXHRcdFx0dGFiSGVhZC5maW5kKCdhW2RhdGEtdG9nZ2xlPVwidGFiXCJdJykuZXEobWUuZGVmYXVsdCkudGFiKCdzaG93Jyk7XG5cdFx0XHR0YWJCb2R5LmZpbmQoJ2Rpdi50YWItcGFuZScpLmVxKG1lLmRlZmF1bHQpLmFkZENsYXNzKCdhY3RpdmUnKTtcblx0XHRcdC8vIH19fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdub3JtYWwnLFxuXHRcdGFjdGlvbjogJ25vdGhpbmcnLFxuXHRcdGNsYXNzZXM6ICdiYWRnZScsXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc3VwZXIucmVuZGVyLmNhbGwodGhpcyk7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzx0ZXh0YXJlYT48L3RleHRhcmVhPicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnRcblx0XHRcdFx0Lmh0bWwodGhpcy52YWx1ZSlcblx0XHRcdFx0Lm9uKCdjaGFuZ2UnLCB0aGlzLmNoYW5nZSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Y2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmVsZW1lbnQudmFsKCk7XG5cdFx0XHR0aGlzLnN1cGVyLmNoYW5nZS5jYWxsKHRoaXMpO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb250YWluZXJEcmF3OiAnc3BhbicsXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cImFsZXJ0IGFsZXJ0LWRhbmdlclwiPjxpIGNsYXNzPVwiaWNvbi13YXJuaW5nLXNpZ25cIj48L2k+IElEOiBcXCcnICsgdGhpcy5pZCArICdcXCcgQXR0ZW1wdGVkIHRvIGxvYWQgbm9uZS1leGlzdGFudCBCYXR0IGZvcm0gdHlwZSBcXCcnICsgdGhpcy50eXBlRmFpbGVkICsgJ1xcJzwvZGl2PicpO1xuXHRcdFx0aWYgKHRoaXMuY2hpbGRyZW4pIHtcblx0XHRcdFx0Zm9yICh2YXIgYyBpbiB0aGlzLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0dmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltjXTtcblx0XHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCc8YnIvPjxzdHJvbmc+Q0hJTEQ6PC9zdHJvbmc+ICcgKyBjaGlsZC50eXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNldDogZnVuY3Rpb24oKSB7XG5cdFx0XHQvLyBOby1vcFxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iXX0=
;