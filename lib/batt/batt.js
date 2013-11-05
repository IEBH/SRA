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
		value: null, // Value can only be valueChecked (i.e. any boolean true) or null
		valueChecked: 1, // The actual value to transmit if checked

		required: false,
		readOnly: null,
		errorRequired: 'String required',

		change: function() {
			this.value = this.element.find('input[type=checkbox]').is(':checked') ? this.valueChecked : null;
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
			} else {
				me.element.removeAttr('checked');
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
					me.clear();
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
				me.clear();
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

		clear: function() {
			this.element.children(':not(.batt-protected)').detach();
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
		renderTag: '<a></a>',
		autoDuplicate: false,

		setup: function() {
			var me = this;
			me.element = $(me.renderTag);
			me.element
				.on('click', function() {
					if (!me.fileInput) { // Never interacted with this file input before
						// NOTE: We have to put the <input type="file"/> elements in their own protected area so they dont get wiped on a batt_container.clear().
						// NOTE2: We have to put them in their own <div>, rather than just appending them, because the browser wont let us trigger the 'click' event unless they are visible - luckily the parent div can be hidden and the input element can be 'shown' to fool the browser into allowing this.
						var parentForm = me.findParent('form');
						var protectedArea = parentForm.element.children('.batt-protected');
						if (!protectedArea.length) // No existing protected area?
							protectedArea = $('<div class="batt-protected" style="display: none"></div>')
								.appendTo(parentForm.element);

						me.fileInput = $('<input type="file" class="batt-protected"/>')
							.attr('name', me.id)
							.on('change', function() {
								me.change.call(me);
							})
							.appendTo(protectedArea);
					}
					me.fileInput.trigger('click');
				});
			return me;
		},

		change: function() {
			var me = this;
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
							cloneOf: originalElement.id,
							fileInput: null
						}), 'after', me.id)
						.render();
			}
			me.super.change.call(me);
		},

		render: function() {
			var me = this;
			if (me.fileInput && me.fileInput.val()) { // Has a file to upload
				me.value = me.fileInput.val().replace(/\\/g,'/').replace( /.*\//,'');
				me.element
					.html(me.parse(me.textUploading))
					.removeClass(me.classes)
					.addClass(me.classesUploading);
			} else { // Nothing to upload but still has syling
				me.element
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
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvbm9kZV9tb2R1bGVzL211c3RhY2hlL211c3RhY2hlLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L25vZGVfbW9kdWxlcy9zaW1wbGUtanNvbi1maWx0ZXIvaW5kZXguanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfYnV0dG9uLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2NoZWNrYm94LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2Nob2ljZS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9jaG9pY2VfcmFkaW8uanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfY29udGFpbmVyLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2NvbnRhaW5lcl9zcGxpdHRlci5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9kYXRlLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2Ryb3Bkb3duLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2VtYWlsLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2ZlZWQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfZmVlZF9iYXR0LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2ZpbGUuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfZm9ybS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9oZWFkaW5nLmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X2h0bWwuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfaW5wdXQuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfbGFiZWwuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfbGluay5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9udW1iZXIuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfb2JqZWN0LmpzIiwiL2hvbWUvbWMvUGFwZXJzL0Ryb3Bib3gvUHJvamVjdHMvQ1JFQlAtU1JBL2xpYi9iYXR0L3NyYy9iYXR0X3JlZmVyZW5jZS5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF9zdHJpbmcuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGFibGUuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGFicy5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF90YWcuanMiLCIvaG9tZS9tYy9QYXBlcnMvRHJvcGJveC9Qcm9qZWN0cy9DUkVCUC1TUkEvbGliL2JhdHQvc3JjL2JhdHRfdGV4dC5qcyIsIi9ob21lL21jL1BhcGVycy9Ecm9wYm94L1Byb2plY3RzL0NSRUJQLVNSQS9saWIvYmF0dC9zcmMvYmF0dF91bmtub3duLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIi8qIVxuICogbXVzdGFjaGUuanMgLSBMb2dpYy1sZXNzIHt7bXVzdGFjaGV9fSB0ZW1wbGF0ZXMgd2l0aCBKYXZhU2NyaXB0XG4gKiBodHRwOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzXG4gKi9cblxuLypnbG9iYWwgZGVmaW5lOiBmYWxzZSovXG5cbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIgJiYgZXhwb3J0cykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeTsgLy8gQ29tbW9uSlNcbiAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShmYWN0b3J5KTsgLy8gQU1EXG4gIH0gZWxzZSB7XG4gICAgcm9vdC5NdXN0YWNoZSA9IGZhY3Rvcnk7IC8vIDxzY3JpcHQ+XG4gIH1cbn0odGhpcywgKGZ1bmN0aW9uICgpIHtcblxuICB2YXIgZXhwb3J0cyA9IHt9O1xuXG4gIGV4cG9ydHMubmFtZSA9IFwibXVzdGFjaGUuanNcIjtcbiAgZXhwb3J0cy52ZXJzaW9uID0gXCIwLjcuMlwiO1xuICBleHBvcnRzLnRhZ3MgPSBbXCJ7e1wiLCBcIn19XCJdO1xuXG4gIGV4cG9ydHMuU2Nhbm5lciA9IFNjYW5uZXI7XG4gIGV4cG9ydHMuQ29udGV4dCA9IENvbnRleHQ7XG4gIGV4cG9ydHMuV3JpdGVyID0gV3JpdGVyO1xuXG4gIHZhciB3aGl0ZVJlID0gL1xccyovO1xuICB2YXIgc3BhY2VSZSA9IC9cXHMrLztcbiAgdmFyIG5vblNwYWNlUmUgPSAvXFxTLztcbiAgdmFyIGVxUmUgPSAvXFxzKj0vO1xuICB2YXIgY3VybHlSZSA9IC9cXHMqXFx9LztcbiAgdmFyIHRhZ1JlID0gLyN8XFxefFxcL3w+fFxce3wmfD18IS87XG5cbiAgLy8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9DT1VDSERCLTU3N1xuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4OVxuICBmdW5jdGlvbiB0ZXN0UmUocmUsIHN0cmluZykge1xuICAgIHJldHVybiBSZWdFeHAucHJvdG90eXBlLnRlc3QuY2FsbChyZSwgc3RyaW5nKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzV2hpdGVzcGFjZShzdHJpbmcpIHtcbiAgICByZXR1cm4gIXRlc3RSZShub25TcGFjZVJlLCBzdHJpbmcpO1xuICB9XG5cbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcbiAgfTtcblxuICBmdW5jdGlvbiBlc2NhcGVSZShzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1tcXC1cXFtcXF17fSgpKis/LixcXFxcXFxeJHwjXFxzXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxuXG4gIHZhciBlbnRpdHlNYXAgPSB7XG4gICAgXCImXCI6IFwiJmFtcDtcIixcbiAgICBcIjxcIjogXCImbHQ7XCIsXG4gICAgXCI+XCI6IFwiJmd0O1wiLFxuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiMzOTsnLFxuICAgIFwiL1wiOiAnJiN4MkY7J1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwoc3RyaW5nKSB7XG4gICAgcmV0dXJuIFN0cmluZyhzdHJpbmcpLnJlcGxhY2UoL1smPD5cIidcXC9dL2csIGZ1bmN0aW9uIChzKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwW3NdO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gRXhwb3J0IHRoZSBlc2NhcGluZyBmdW5jdGlvbiBzbyB0aGF0IHRoZSB1c2VyIG1heSBvdmVycmlkZSBpdC5cbiAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8yNDRcbiAgZXhwb3J0cy5lc2NhcGUgPSBlc2NhcGVIdG1sO1xuXG4gIGZ1bmN0aW9uIFNjYW5uZXIoc3RyaW5nKSB7XG4gICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gICAgdGhpcy50YWlsID0gc3RyaW5nO1xuICAgIHRoaXMucG9zID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFpbCBpcyBlbXB0eSAoZW5kIG9mIHN0cmluZykuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5lb3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFpbCA9PT0gXCJcIjtcbiAgfTtcblxuICAvKipcbiAgICogVHJpZXMgdG8gbWF0Y2ggdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBhdCB0aGUgY3VycmVudCBwb3NpdGlvbi5cbiAgICogUmV0dXJucyB0aGUgbWF0Y2hlZCB0ZXh0IGlmIGl0IGNhbiBtYXRjaCwgdGhlIGVtcHR5IHN0cmluZyBvdGhlcndpc2UuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuID0gZnVuY3Rpb24gKHJlKSB7XG4gICAgdmFyIG1hdGNoID0gdGhpcy50YWlsLm1hdGNoKHJlKTtcblxuICAgIGlmIChtYXRjaCAmJiBtYXRjaC5pbmRleCA9PT0gMCkge1xuICAgICAgdGhpcy50YWlsID0gdGhpcy50YWlsLnN1YnN0cmluZyhtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgdGhpcy5wb3MgKz0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgcmV0dXJuIG1hdGNoWzBdO1xuICAgIH1cblxuICAgIHJldHVybiBcIlwiO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTa2lwcyBhbGwgdGV4dCB1bnRpbCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGNhbiBiZSBtYXRjaGVkLiBSZXR1cm5zXG4gICAqIHRoZSBza2lwcGVkIHN0cmluZywgd2hpY2ggaXMgdGhlIGVudGlyZSB0YWlsIGlmIG5vIG1hdGNoIGNhbiBiZSBtYWRlLlxuICAgKi9cbiAgU2Nhbm5lci5wcm90b3R5cGUuc2NhblVudGlsID0gZnVuY3Rpb24gKHJlKSB7XG4gICAgdmFyIG1hdGNoLCBwb3MgPSB0aGlzLnRhaWwuc2VhcmNoKHJlKTtcblxuICAgIHN3aXRjaCAocG9zKSB7XG4gICAgY2FzZSAtMTpcbiAgICAgIG1hdGNoID0gdGhpcy50YWlsO1xuICAgICAgdGhpcy5wb3MgKz0gdGhpcy50YWlsLmxlbmd0aDtcbiAgICAgIHRoaXMudGFpbCA9IFwiXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDA6XG4gICAgICBtYXRjaCA9IFwiXCI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgbWF0Y2ggPSB0aGlzLnRhaWwuc3Vic3RyaW5nKDAsIHBvcyk7XG4gICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKHBvcyk7XG4gICAgICB0aGlzLnBvcyArPSBwb3M7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGNoO1xuICB9O1xuXG4gIGZ1bmN0aW9uIENvbnRleHQodmlldywgcGFyZW50KSB7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICB0aGlzLmNsZWFyQ2FjaGUoKTtcbiAgfVxuXG4gIENvbnRleHQubWFrZSA9IGZ1bmN0aW9uICh2aWV3KSB7XG4gICAgcmV0dXJuICh2aWV3IGluc3RhbmNlb2YgQ29udGV4dCkgPyB2aWV3IDogbmV3IENvbnRleHQodmlldyk7XG4gIH07XG5cbiAgQ29udGV4dC5wcm90b3R5cGUuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9jYWNoZSA9IHt9O1xuICB9O1xuXG4gIENvbnRleHQucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAodmlldykge1xuICAgIHJldHVybiBuZXcgQ29udGV4dCh2aWV3LCB0aGlzKTtcbiAgfTtcblxuICBDb250ZXh0LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMuX2NhY2hlW25hbWVdO1xuXG4gICAgaWYgKCF2YWx1ZSkge1xuICAgICAgaWYgKG5hbWUgPT09IFwiLlwiKSB7XG4gICAgICAgIHZhbHVlID0gdGhpcy52aWV3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGNvbnRleHQgPSB0aGlzO1xuXG4gICAgICAgIHdoaWxlIChjb250ZXh0KSB7XG4gICAgICAgICAgaWYgKG5hbWUuaW5kZXhPZihcIi5cIikgPiAwKSB7XG4gICAgICAgICAgICB2YXIgbmFtZXMgPSBuYW1lLnNwbGl0KFwiLlwiKSwgaSA9IDA7XG5cbiAgICAgICAgICAgIHZhbHVlID0gY29udGV4dC52aWV3O1xuXG4gICAgICAgICAgICB3aGlsZSAodmFsdWUgJiYgaSA8IG5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlW25hbWVzW2krK11dO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlld1tuYW1lXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29udGV4dCA9IGNvbnRleHQucGFyZW50O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2NhY2hlW25hbWVdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwodGhpcy52aWV3KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgZnVuY3Rpb24gV3JpdGVyKCkge1xuICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xuICB9XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5jbGVhckNhY2hlID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX2NhY2hlID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5jb21waWxlID0gZnVuY3Rpb24gKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgdmFyIGZuID0gdGhpcy5fY2FjaGVbdGVtcGxhdGVdO1xuXG4gICAgaWYgKCFmbikge1xuICAgICAgdmFyIHRva2VucyA9IGV4cG9ydHMucGFyc2UodGVtcGxhdGUsIHRhZ3MpO1xuICAgICAgZm4gPSB0aGlzLl9jYWNoZVt0ZW1wbGF0ZV0gPSB0aGlzLmNvbXBpbGVUb2tlbnModG9rZW5zLCB0ZW1wbGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZuO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuY29tcGlsZVBhcnRpYWwgPSBmdW5jdGlvbiAobmFtZSwgdGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB2YXIgZm4gPSB0aGlzLmNvbXBpbGUodGVtcGxhdGUsIHRhZ3MpO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZVtuYW1lXSA9IGZuO1xuICAgIHJldHVybiBmbjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLmNvbXBpbGVUb2tlbnMgPSBmdW5jdGlvbiAodG9rZW5zLCB0ZW1wbGF0ZSkge1xuICAgIHZhciBmbiA9IGNvbXBpbGVUb2tlbnModG9rZW5zKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgICBpZiAocGFydGlhbHMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBwYXJ0aWFscyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgc2VsZi5fbG9hZFBhcnRpYWwgPSBwYXJ0aWFscztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHBhcnRpYWxzKSB7XG4gICAgICAgICAgICBzZWxmLmNvbXBpbGVQYXJ0aWFsKG5hbWUsIHBhcnRpYWxzW25hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZuKHNlbGYsIENvbnRleHQubWFrZSh2aWV3KSwgdGVtcGxhdGUpO1xuICAgIH07XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZSh0ZW1wbGF0ZSkodmlldywgcGFydGlhbHMpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuX3NlY3Rpb24gPSBmdW5jdGlvbiAobmFtZSwgY29udGV4dCwgdGV4dCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cChuYW1lKTtcblxuICAgIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHZhciBidWZmZXIgPSBcIlwiO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgIGJ1ZmZlciArPSBjYWxsYmFjayh0aGlzLCBjb250ZXh0LnB1c2godmFsdWVbaV0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBidWZmZXI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB2YWx1ZSA/IGNhbGxiYWNrKHRoaXMsIGNvbnRleHQucHVzaCh2YWx1ZSkpIDogXCJcIjtcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciBzY29wZWRSZW5kZXIgPSBmdW5jdGlvbiAodGVtcGxhdGUpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYucmVuZGVyKHRlbXBsYXRlLCBjb250ZXh0KTtcbiAgICAgIH07XG5cbiAgICAgIHZhciByZXN1bHQgPSB2YWx1ZS5jYWxsKGNvbnRleHQudmlldywgdGV4dCwgc2NvcGVkUmVuZGVyKTtcbiAgICAgIHJldHVybiByZXN1bHQgIT0gbnVsbCA/IHJlc3VsdCA6IFwiXCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodGhpcywgY29udGV4dCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5faW52ZXJ0ZWQgPSBmdW5jdGlvbiAobmFtZSwgY29udGV4dCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cChuYW1lKTtcblxuICAgIC8vIFVzZSBKYXZhU2NyaXB0J3MgZGVmaW5pdGlvbiBvZiBmYWxzeS4gSW5jbHVkZSBlbXB0eSBhcnJheXMuXG4gICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8xODZcbiAgICBpZiAoIXZhbHVlIHx8IChpc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2sodGhpcywgY29udGV4dCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5fcGFydGlhbCA9IGZ1bmN0aW9uIChuYW1lLCBjb250ZXh0KSB7XG4gICAgaWYgKCEobmFtZSBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpICYmIHRoaXMuX2xvYWRQYXJ0aWFsKSB7XG4gICAgICB0aGlzLmNvbXBpbGVQYXJ0aWFsKG5hbWUsIHRoaXMuX2xvYWRQYXJ0aWFsKG5hbWUpKTtcbiAgICB9XG5cbiAgICB2YXIgZm4gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbbmFtZV07XG5cbiAgICByZXR1cm4gZm4gPyBmbihjb250ZXh0KSA6IFwiXCI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5fbmFtZSA9IGZ1bmN0aW9uIChuYW1lLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAobmFtZSk7XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUuY2FsbChjb250ZXh0LnZpZXcpO1xuICAgIH1cblxuICAgIHJldHVybiAodmFsdWUgPT0gbnVsbCkgPyBcIlwiIDogU3RyaW5nKHZhbHVlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl9lc2NhcGVkID0gZnVuY3Rpb24gKG5hbWUsIGNvbnRleHQpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5lc2NhcGUodGhpcy5fbmFtZShuYW1lLCBjb250ZXh0KSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIExvdy1sZXZlbCBmdW5jdGlvbiB0aGF0IGNvbXBpbGVzIHRoZSBnaXZlbiBgdG9rZW5zYCBpbnRvIGEgZnVuY3Rpb25cbiAgICogdGhhdCBhY2NlcHRzIHRocmVlIGFyZ3VtZW50czogYSBXcml0ZXIsIGEgQ29udGV4dCwgYW5kIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIGZ1bmN0aW9uIGNvbXBpbGVUb2tlbnModG9rZW5zKSB7XG4gICAgdmFyIHN1YlJlbmRlcnMgPSB7fTtcblxuICAgIGZ1bmN0aW9uIHN1YlJlbmRlcihpLCB0b2tlbnMsIHRlbXBsYXRlKSB7XG4gICAgICBpZiAoIXN1YlJlbmRlcnNbaV0pIHtcbiAgICAgICAgdmFyIGZuID0gY29tcGlsZVRva2Vucyh0b2tlbnMpO1xuICAgICAgICBzdWJSZW5kZXJzW2ldID0gZnVuY3Rpb24gKHdyaXRlciwgY29udGV4dCkge1xuICAgICAgICAgIHJldHVybiBmbih3cml0ZXIsIGNvbnRleHQsIHRlbXBsYXRlKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHN1YlJlbmRlcnNbaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh3cml0ZXIsIGNvbnRleHQsIHRlbXBsYXRlKSB7XG4gICAgICB2YXIgYnVmZmVyID0gXCJcIjtcbiAgICAgIHZhciB0b2tlbiwgc2VjdGlvblRleHQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0b2tlbnMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgICAgc3dpdGNoICh0b2tlblswXSkge1xuICAgICAgICBjYXNlIFwiI1wiOlxuICAgICAgICAgIHNlY3Rpb25UZXh0ID0gdGVtcGxhdGUuc2xpY2UodG9rZW5bM10sIHRva2VuWzVdKTtcbiAgICAgICAgICBidWZmZXIgKz0gd3JpdGVyLl9zZWN0aW9uKHRva2VuWzFdLCBjb250ZXh0LCBzZWN0aW9uVGV4dCwgc3ViUmVuZGVyKGksIHRva2VuWzRdLCB0ZW1wbGF0ZSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiXlwiOlxuICAgICAgICAgIGJ1ZmZlciArPSB3cml0ZXIuX2ludmVydGVkKHRva2VuWzFdLCBjb250ZXh0LCBzdWJSZW5kZXIoaSwgdG9rZW5bNF0sIHRlbXBsYXRlKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCI+XCI6XG4gICAgICAgICAgYnVmZmVyICs9IHdyaXRlci5fcGFydGlhbCh0b2tlblsxXSwgY29udGV4dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCImXCI6XG4gICAgICAgICAgYnVmZmVyICs9IHdyaXRlci5fbmFtZSh0b2tlblsxXSwgY29udGV4dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJuYW1lXCI6XG4gICAgICAgICAgYnVmZmVyICs9IHdyaXRlci5fZXNjYXBlZCh0b2tlblsxXSwgY29udGV4dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJ0ZXh0XCI6XG4gICAgICAgICAgYnVmZmVyICs9IHRva2VuWzFdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBidWZmZXI7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtcyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgaW50byBhIG5lc3RlZCB0cmVlIHN0cnVjdHVyZSB3aGVyZVxuICAgKiB0b2tlbnMgdGhhdCByZXByZXNlbnQgYSBzZWN0aW9uIGhhdmUgdHdvIGFkZGl0aW9uYWwgaXRlbXM6IDEpIGFuIGFycmF5IG9mXG4gICAqIGFsbCB0b2tlbnMgdGhhdCBhcHBlYXIgaW4gdGhhdCBzZWN0aW9uIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsXG4gICAqIHRlbXBsYXRlIHRoYXQgcmVwcmVzZW50cyB0aGUgZW5kIG9mIHRoYXQgc2VjdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIG5lc3RUb2tlbnModG9rZW5zKSB7XG4gICAgdmFyIHRyZWUgPSBbXTtcbiAgICB2YXIgY29sbGVjdG9yID0gdHJlZTtcbiAgICB2YXIgc2VjdGlvbnMgPSBbXTtcblxuICAgIHZhciB0b2tlbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdG9rZW5zLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgIHN3aXRjaCAodG9rZW5bMF0pIHtcbiAgICAgIGNhc2UgJyMnOlxuICAgICAgY2FzZSAnXic6XG4gICAgICAgIHNlY3Rpb25zLnB1c2godG9rZW4pO1xuICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICAgIGNvbGxlY3RvciA9IHRva2VuWzRdID0gW107XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLyc6XG4gICAgICAgIHZhciBzZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG4gICAgICAgIHNlY3Rpb25bNV0gPSB0b2tlblsyXTtcbiAgICAgICAgY29sbGVjdG9yID0gc2VjdGlvbnMubGVuZ3RoID4gMCA/IHNlY3Rpb25zW3NlY3Rpb25zLmxlbmd0aCAtIDFdWzRdIDogdHJlZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRyZWU7XG4gIH1cblxuICAvKipcbiAgICogQ29tYmluZXMgdGhlIHZhbHVlcyBvZiBjb25zZWN1dGl2ZSB0ZXh0IHRva2VucyBpbiB0aGUgZ2l2ZW4gYHRva2Vuc2AgYXJyYXlcbiAgICogdG8gYSBzaW5nbGUgdG9rZW4uXG4gICAqL1xuICBmdW5jdGlvbiBzcXVhc2hUb2tlbnModG9rZW5zKSB7XG4gICAgdmFyIHNxdWFzaGVkVG9rZW5zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIGxhc3RUb2tlbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdG9rZW5zLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgIGlmICh0b2tlblswXSA9PT0gJ3RleHQnICYmIGxhc3RUb2tlbiAmJiBsYXN0VG9rZW5bMF0gPT09ICd0ZXh0Jykge1xuICAgICAgICBsYXN0VG9rZW5bMV0gKz0gdG9rZW5bMV07XG4gICAgICAgIGxhc3RUb2tlblszXSA9IHRva2VuWzNdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGFzdFRva2VuID0gdG9rZW47XG4gICAgICAgIHNxdWFzaGVkVG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcXVhc2hlZFRva2VucztcbiAgfVxuXG4gIGZ1bmN0aW9uIGVzY2FwZVRhZ3ModGFncykge1xuICAgIHJldHVybiBbXG4gICAgICBuZXcgUmVnRXhwKGVzY2FwZVJlKHRhZ3NbMF0pICsgXCJcXFxccypcIiksXG4gICAgICBuZXcgUmVnRXhwKFwiXFxcXHMqXCIgKyBlc2NhcGVSZSh0YWdzWzFdKSlcbiAgICBdO1xuICB9XG5cbiAgLyoqXG4gICAqIEJyZWFrcyB1cCB0aGUgZ2l2ZW4gYHRlbXBsYXRlYCBzdHJpbmcgaW50byBhIHRyZWUgb2YgdG9rZW4gb2JqZWN0cy4gSWZcbiAgICogYHRhZ3NgIGlzIGdpdmVuIGhlcmUgaXQgbXVzdCBiZSBhbiBhcnJheSB3aXRoIHR3byBzdHJpbmcgdmFsdWVzOiB0aGVcbiAgICogb3BlbmluZyBhbmQgY2xvc2luZyB0YWdzIHVzZWQgaW4gdGhlIHRlbXBsYXRlIChlLmcuIFtcIjwlXCIsIFwiJT5cIl0pLiBPZlxuICAgKiBjb3Vyc2UsIHRoZSBkZWZhdWx0IGlzIHRvIHVzZSBtdXN0YWNoZXMgKGkuZS4gTXVzdGFjaGUudGFncykuXG4gICAqL1xuICBleHBvcnRzLnBhcnNlID0gZnVuY3Rpb24gKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZSB8fCAnJztcbiAgICB0YWdzID0gdGFncyB8fCBleHBvcnRzLnRhZ3M7XG5cbiAgICBpZiAodHlwZW9mIHRhZ3MgPT09ICdzdHJpbmcnKSB0YWdzID0gdGFncy5zcGxpdChzcGFjZVJlKTtcbiAgICBpZiAodGFncy5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWdzOiAnICsgdGFncy5qb2luKCcsICcpKTtcbiAgICB9XG5cbiAgICB2YXIgdGFnUmVzID0gZXNjYXBlVGFncyh0YWdzKTtcbiAgICB2YXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKHRlbXBsYXRlKTtcblxuICAgIHZhciBzZWN0aW9ucyA9IFtdOyAgICAgLy8gU3RhY2sgdG8gaG9sZCBzZWN0aW9uIHRva2Vuc1xuICAgIHZhciB0b2tlbnMgPSBbXTsgICAgICAgLy8gQnVmZmVyIHRvIGhvbGQgdGhlIHRva2Vuc1xuICAgIHZhciBzcGFjZXMgPSBbXTsgICAgICAgLy8gSW5kaWNlcyBvZiB3aGl0ZXNwYWNlIHRva2VucyBvbiB0aGUgY3VycmVudCBsaW5lXG4gICAgdmFyIGhhc1RhZyA9IGZhbHNlOyAgICAvLyBJcyB0aGVyZSBhIHt7dGFnfX0gb24gdGhlIGN1cnJlbnQgbGluZT9cbiAgICB2YXIgbm9uU3BhY2UgPSBmYWxzZTsgIC8vIElzIHRoZXJlIGEgbm9uLXNwYWNlIGNoYXIgb24gdGhlIGN1cnJlbnQgbGluZT9cblxuICAgIC8vIFN0cmlwcyBhbGwgd2hpdGVzcGFjZSB0b2tlbnMgYXJyYXkgZm9yIHRoZSBjdXJyZW50IGxpbmVcbiAgICAvLyBpZiB0aGVyZSB3YXMgYSB7eyN0YWd9fSBvbiBpdCBhbmQgb3RoZXJ3aXNlIG9ubHkgc3BhY2UuXG4gICAgZnVuY3Rpb24gc3RyaXBTcGFjZSgpIHtcbiAgICAgIGlmIChoYXNUYWcgJiYgIW5vblNwYWNlKSB7XG4gICAgICAgIHdoaWxlIChzcGFjZXMubGVuZ3RoKSB7XG4gICAgICAgICAgdG9rZW5zLnNwbGljZShzcGFjZXMucG9wKCksIDEpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGFjZXMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgaGFzVGFnID0gZmFsc2U7XG4gICAgICBub25TcGFjZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBzdGFydCwgdHlwZSwgdmFsdWUsIGNocjtcbiAgICB3aGlsZSAoIXNjYW5uZXIuZW9zKCkpIHtcbiAgICAgIHN0YXJ0ID0gc2Nhbm5lci5wb3M7XG4gICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKHRhZ1Jlc1swXSk7XG5cbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICBjaHIgPSB2YWx1ZS5jaGFyQXQoaSk7XG5cbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGNocikpIHtcbiAgICAgICAgICAgIHNwYWNlcy5wdXNoKHRva2Vucy5sZW5ndGgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdG9rZW5zLnB1c2goW1widGV4dFwiLCBjaHIsIHN0YXJ0LCBzdGFydCArIDFdKTtcbiAgICAgICAgICBzdGFydCArPSAxO1xuXG4gICAgICAgICAgaWYgKGNociA9PT0gXCJcXG5cIikge1xuICAgICAgICAgICAgc3RyaXBTcGFjZSgpOyAvLyBDaGVjayBmb3Igd2hpdGVzcGFjZSBvbiB0aGUgY3VycmVudCBsaW5lLlxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzdGFydCA9IHNjYW5uZXIucG9zO1xuXG4gICAgICAvLyBNYXRjaCB0aGUgb3BlbmluZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2Nhbih0YWdSZXNbMF0pKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBoYXNUYWcgPSB0cnVlO1xuICAgICAgdHlwZSA9IHNjYW5uZXIuc2Nhbih0YWdSZSkgfHwgXCJuYW1lXCI7XG5cbiAgICAgIC8vIFNraXAgYW55IHdoaXRlc3BhY2UgYmV0d2VlbiB0YWcgYW5kIHZhbHVlLlxuICAgICAgc2Nhbm5lci5zY2FuKHdoaXRlUmUpO1xuXG4gICAgICAvLyBFeHRyYWN0IHRoZSB0YWcgdmFsdWUuXG4gICAgICBpZiAodHlwZSA9PT0gXCI9XCIpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChlcVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuKGVxUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbCh0YWdSZXNbMV0pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcIntcIikge1xuICAgICAgICB2YXIgY2xvc2VSZSA9IG5ldyBSZWdFeHAoXCJcXFxccypcIiArIGVzY2FwZVJlKFwifVwiICsgdGFnc1sxXSkpO1xuICAgICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKGNsb3NlUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oY3VybHlSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhblVudGlsKHRhZ1Jlc1sxXSk7XG4gICAgICAgIHR5cGUgPSBcIiZcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwodGFnUmVzWzFdKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggdGhlIGNsb3NpbmcgdGFnLlxuICAgICAgaWYgKCFzY2FubmVyLnNjYW4odGFnUmVzWzFdKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHRhZyBhdCAnICsgc2Nhbm5lci5wb3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBDaGVjayBzZWN0aW9uIG5lc3RpbmcuXG4gICAgICBpZiAodHlwZSA9PT0gJy8nKSB7XG4gICAgICAgIGlmIChzZWN0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vub3BlbmVkIHNlY3Rpb24gXCInICsgdmFsdWUgKyAnXCIgYXQgJyArIHN0YXJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG5cbiAgICAgICAgaWYgKHNlY3Rpb25bMV0gIT09IHZhbHVlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCBzZWN0aW9uIFwiJyArIHNlY3Rpb25bMV0gKyAnXCIgYXQgJyArIHN0YXJ0KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgdG9rZW4gPSBbdHlwZSwgdmFsdWUsIHN0YXJ0LCBzY2FubmVyLnBvc107XG4gICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG5cbiAgICAgIGlmICh0eXBlID09PSAnIycgfHwgdHlwZSA9PT0gJ14nKSB7XG4gICAgICAgIHNlY3Rpb25zLnB1c2godG9rZW4pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcIm5hbWVcIiB8fCB0eXBlID09PSBcIntcIiB8fCB0eXBlID09PSBcIiZcIikge1xuICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwiPVwiKSB7XG4gICAgICAgIC8vIFNldCB0aGUgdGFncyBmb3IgdGhlIG5leHQgdGltZSBhcm91bmQuXG4gICAgICAgIHRhZ3MgPSB2YWx1ZS5zcGxpdChzcGFjZVJlKTtcblxuICAgICAgICBpZiAodGFncy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdGFncyBhdCAnICsgc3RhcnQgKyAnOiAnICsgdGFncy5qb2luKCcsICcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhZ1JlcyA9IGVzY2FwZVRhZ3ModGFncyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIHRoZXJlIGFyZSBubyBvcGVuIHNlY3Rpb25zIHdoZW4gd2UncmUgZG9uZS5cbiAgICB2YXIgc2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuICAgIGlmIChzZWN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgc2VjdGlvblsxXSArICdcIiBhdCAnICsgc2Nhbm5lci5wb3MpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXN0VG9rZW5zKHNxdWFzaFRva2Vucyh0b2tlbnMpKTtcbiAgfTtcblxuICAvLyBUaGUgaGlnaC1sZXZlbCBjbGVhckNhY2hlLCBjb21waWxlLCBjb21waWxlUGFydGlhbCwgYW5kIHJlbmRlciBmdW5jdGlvbnNcbiAgLy8gdXNlIHRoaXMgZGVmYXVsdCB3cml0ZXIuXG4gIHZhciBfd3JpdGVyID0gbmV3IFdyaXRlcigpO1xuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgYW5kIHBhcnRpYWxzIGluIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIGV4cG9ydHMuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gX3dyaXRlci5jbGVhckNhY2hlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBpbGVzIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHRvIGEgcmV1c2FibGUgZnVuY3Rpb24gdXNpbmcgdGhlIGRlZmF1bHRcbiAgICogd3JpdGVyLlxuICAgKi9cbiAgZXhwb3J0cy5jb21waWxlID0gZnVuY3Rpb24gKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgcmV0dXJuIF93cml0ZXIuY29tcGlsZSh0ZW1wbGF0ZSwgdGFncyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBpbGVzIHRoZSBwYXJ0aWFsIHdpdGggdGhlIGdpdmVuIGBuYW1lYCBhbmQgYHRlbXBsYXRlYCB0byBhIHJldXNhYmxlXG4gICAqIGZ1bmN0aW9uIHVzaW5nIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIGV4cG9ydHMuY29tcGlsZVBhcnRpYWwgPSBmdW5jdGlvbiAobmFtZSwgdGVtcGxhdGUsIHRhZ3MpIHtcbiAgICByZXR1cm4gX3dyaXRlci5jb21waWxlUGFydGlhbChuYW1lLCB0ZW1wbGF0ZSwgdGFncyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENvbXBpbGVzIHRoZSBnaXZlbiBhcnJheSBvZiB0b2tlbnMgKHRoZSBvdXRwdXQgb2YgYSBwYXJzZSkgdG8gYSByZXVzYWJsZVxuICAgKiBmdW5jdGlvbiB1c2luZyB0aGUgZGVmYXVsdCB3cml0ZXIuXG4gICAqL1xuICBleHBvcnRzLmNvbXBpbGVUb2tlbnMgPSBmdW5jdGlvbiAodG9rZW5zLCB0ZW1wbGF0ZSkge1xuICAgIHJldHVybiBfd3JpdGVyLmNvbXBpbGVUb2tlbnModG9rZW5zLCB0ZW1wbGF0ZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbmRlcnMgdGhlIGB0ZW1wbGF0ZWAgd2l0aCB0aGUgZ2l2ZW4gYHZpZXdgIGFuZCBgcGFydGlhbHNgIHVzaW5nIHRoZVxuICAgKiBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIGV4cG9ydHMucmVuZGVyID0gZnVuY3Rpb24gKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscykge1xuICAgIHJldHVybiBfd3JpdGVyLnJlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpO1xuICB9O1xuXG4gIC8vIFRoaXMgaXMgaGVyZSBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCAwLjQueC5cbiAgZXhwb3J0cy50b19odG1sID0gZnVuY3Rpb24gKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscywgc2VuZCkge1xuICAgIHZhciByZXN1bHQgPSBleHBvcnRzLnJlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpO1xuXG4gICAgaWYgKHR5cGVvZiBzZW5kID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHNlbmQocmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIGV4cG9ydHM7XG5cbn0oKSkpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuXHR0aGlzLmRlZmF1bHRFcXVhbHMgPSB0cnVlOyAvLyBJZiB3ZSBjYW4ndCBmaW5kIGEgdmFsaWQgaGFuZGxlciBkZWZhdWx0IHRvIGtleT09dmFsIGJlaGF2aW91ciAoaS5lLiB7J2Zvbyc6ICdiYXInfSB0ZXN0cyB0aGF0IHRoZSBrZXkgJ2ZvbycgaXMgdGhlIHZhbHVlICdiYXInKVxuXHR0aGlzLnNpbGVudCA9IGZhbHNlOyAvLyBTaHV0IHVwIGlmIHdlIGNhbnQgZmluZCBhIHN1aXRhYmxlIGhhbmRsZXJcblxuXHR0aGlzLmhhbmRsZXJzID0gW107XG5cblx0dGhpcy5teUZpbHRlciA9IG51bGw7XG5cdHRoaXMubXlEYXRhID0gbnVsbDtcblx0dGhpcy5teUxpbWl0ID0gbnVsbDtcblx0dGhpcy5teVdhbnRBcnJheSA9IGZhbHNlO1xuXG5cdHRoaXMuaW5pdCA9IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuYWRkSGFuZGxlcigvXiguKj8pID17MSwyfSQvLCBmdW5jdGlvbihrZXksIHZhbCwgZGF0YSkgeyAvLyB7J2ZvbyA9JzogJ2Jhcid9IG9yIHsnZm9vID09JzogJ2Jhcid9XG5cdFx0XHRyZXR1cm4gKGRhdGFba2V5XSA9PSB2YWwpO1xuXHRcdH0pO1xuXHRcdHRoaXMuYWRkSGFuZGxlcigvXiguKj8pID4kLywgZnVuY3Rpb24oa2V5LCB2YWwsIGRhdGEpIHsgLy8geydmb28gPic6ICdiYXInfVxuXHRcdFx0cmV0dXJuIChkYXRhW2tleV0gPiB2YWwpO1xuXHRcdH0pO1xuXHRcdHRoaXMuYWRkSGFuZGxlcigvXiguKj8pIDwkLywgZnVuY3Rpb24oa2V5LCB2YWwsIGRhdGEpIHsgLy8geydmb28gPCc6ICdiYXInfVxuXHRcdFx0cmV0dXJuIChkYXRhW2tleV0gPCB2YWwpO1xuXHRcdH0pO1xuXHRcdHRoaXMuYWRkSGFuZGxlcigvXiguKj8pICg/Oj49fD0+KSQvLCBmdW5jdGlvbihrZXksIHZhbCwgZGF0YSkgeyAvLyB7J2ZvbyA+PSc6ICdiYXInfSAob3IgJz0+Jylcblx0XHRcdHJldHVybiAoZGF0YVtrZXldID49IHZhbCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGRIYW5kbGVyKC9eKC4qPykgKD86PD18PTwpJC8sIGZ1bmN0aW9uKGtleSwgdmFsLCBkYXRhKSB7IC8vIHsnZm9vIDw9JzogJ2Jhcid9IG9yICgnPTwnKVxuXHRcdFx0cmV0dXJuIChkYXRhW2tleV0gPD0gdmFsKTtcblx0XHR9KTtcblx0fTtcblxuXHQvLyBTaW1wbGUgc2V0dGVycyB7e3tcblx0dGhpcy5maWx0ZXIgPSBmdW5jdGlvbihmaWx0ZXIpIHtcblx0XHR0aGlzLm15RmlsdGVyID0gZmlsdGVyO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdHRoaXMuZGF0YSA9IGZ1bmN0aW9uKGRhdGEpIHtcblx0XHR0aGlzLm15RGF0YSA9IGRhdGE7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dGhpcy5saW1pdCA9IGZ1bmN0aW9uKGxpbWl0KSB7XG5cdFx0dGhpcy5teUxpbWl0ID0gbGltaXQ7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dGhpcy53YW50QXJyYXkgPSBmdW5jdGlvbih3YW50QXJyYXkpIHtcblx0XHR0aGlzLm15V2FudEFycmF5ID0gd2FudEFycmF5ID09PSB1bmRlZmluZWQgPyB0cnVlIDogd2FudEFycmF5O1xuXHRcdHJldHVybiB0aGlzO1xuXHR9O1xuXHQvLyB9fX1cblxuXHR0aGlzLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5teURhdGEgPSBudWxsO1xuXHRcdHRoaXMubXlGaWx0ZXIgPSBudWxsO1xuXHRcdHRoaXMubXlXYW50QXJyYXkgPSBmYWxzZTtcblx0XHR0aGlzLm15TGltaXQgPSAwO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdHRoaXMuYWRkSGFuZGxlciA9IGZ1bmN0aW9uKHJlLCBjYWxsYmFjaykge1xuXHRcdHRoaXMuaGFuZGxlcnMucHVzaChbcmUsIGNhbGxiYWNrXSk7XG5cdH07XG5cblx0dGhpcy5leGVjID0gZnVuY3Rpb24oZmlsdGVyLCBkYXRhLCBsaW1pdCkge1xuXHRcdHZhciBvdXQgPSB0aGlzLm15V2FudEFycmF5ID8gW10gOiB7fTtcblx0XHR2YXIgZm91bmQgPSAwO1xuXHRcdGlmICghZmlsdGVyKVxuXHRcdFx0ZmlsdGVyID0gdGhpcy5teUZpbHRlcjtcblx0XHRpZiAoIWRhdGEpXG5cdFx0XHRkYXRhID0gdGhpcy5teURhdGE7XG5cdFx0aWYgKCFsaW1pdClcblx0XHRcdGxpbWl0ID0gdGhpcy5teUxpbWl0O1xuXG5cdFx0Zm9yICh2YXIgaWQgaW4gZGF0YSkge1xuXHRcdFx0dmFyIHJvdyA9IGRhdGFbaWRdO1xuXHRcdFx0aWYgKHRoaXMubWF0Y2hlcyhmaWx0ZXIsIHJvdykpIHtcblx0XHRcdFx0aWYgKHRoaXMubXlXYW50QXJyYXkpIHtcblx0XHRcdFx0XHRvdXQucHVzaChyb3cpO1xuXHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHRvdXRbaWRdID0gcm93O1xuXG5cdFx0XHRcdGlmIChsaW1pdCAmJiArK2ZvdW5kID49IGxpbWl0KVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0O1xuXHR9O1xuXG5cdHRoaXMubWF0Y2hlcyA9IGZ1bmN0aW9uKGZpbHRlciwgZGF0YSkge1xuXHRcdGZvciAodmFyIGtleSBpbiBmaWx0ZXIpIHtcblx0XHRcdHZhciBoYW5kbGVkID0gZmFsc2U7XG5cdFx0XHRmb3IgKHZhciBoIGluIHRoaXMuaGFuZGxlcnMpIHtcblx0XHRcdFx0dmFyIG1hdGNoZXM7XG5cdFx0XHRcdGlmIChtYXRjaGVzID0gdGhpcy5oYW5kbGVyc1toXVswXS5leGVjKGtleSkpIHsgLy8gVXNlIHRoaXMgaGFuZGxlclxuXHRcdFx0XHRcdGhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdGlmICh0aGlzLmhhbmRsZXJzW2hdWzFdKG1hdGNoZXNbMV0sIGZpbHRlcltrZXldLCBkYXRhKSkge1xuXHRcdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ09LJyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghaGFuZGxlZClcblx0XHRcdFx0aWYgKHRoaXMuZGVmYXVsdEVxdWFscykge1xuXHRcdFx0XHRcdGlmIChkYXRhW2tleV0gIT0gZmlsdGVyW2tleV0pXG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLnNpbGVudClcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignTm8gZmlsdGVyIG1hdGNoaW5nIGluY29tbWluZyBzdHJpbmcgXCInICsga2V5ICsgJ1wiLiBEZWZhdWx0aW5nIHRvIG5vLW1hdGNoJyk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9O1xuXG5cdHRoaXMuaW5pdCgpO1xufVxuIiwidmFyIGdsb2JhbD1zZWxmOy8qKlxuKiBCYXR0XG4qIEZvcm0gYW5kIGRhdGEgbWFuaXB1bGF0aW9uIGxpYnJhcnlcbipcbiogQHVybCBodHRwczovL2dpdGh1Yi5jb20vTW9tc0ZyaWVuZGx5RGV2Q28vQmF0dFxuKiBAYXV0aG9yIE1hdHQgQ2FydGVyIDxtQHR0Y2FydGVyLmNvbT5cbiogQGxpY2Vuc2UgQ0MtQXR0cmlidXRpb24tTm9uQ29tbWVyY2lhbC1Ob0Rlcml2cyAzLjAgVW5wb3J0ZWRcbiogQGxpY2Vuc2VVUkwgaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbGljZW5zZXMvYnktbmMtbmQvMy4wL1xuKi9cblxuLy8gUkVRVUlSRSAtIEJhdHQgb2JqZWN0cyB7e3tcbnZhciBiYXR0X29iamVjdCA9IHJlcXVpcmUoJy4vYmF0dF9vYmplY3QuanMnKTtcblxudmFyIGJhdHRfY2hlY2tib3ggPSByZXF1aXJlKCcuL2JhdHRfY2hlY2tib3guanMnKTtcbmJhdHRfY2hlY2tib3gucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9kYXRlID0gcmVxdWlyZSgnLi9iYXR0X2RhdGUuanMnKTtcbmJhdHRfZGF0ZS5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2Nob2ljZSA9IHJlcXVpcmUoJy4vYmF0dF9jaG9pY2UuanMnKTtcbmJhdHRfY2hvaWNlLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xudmFyIGJhdHRfY2hvaWNlX3JhZGlvID0gcmVxdWlyZSgnLi9iYXR0X2Nob2ljZV9yYWRpby5qcycpO1xuYmF0dF9jaG9pY2VfcmFkaW8ucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9jb250YWluZXIgPSByZXF1aXJlKCcuL2JhdHRfY29udGFpbmVyLmpzJyk7XG5iYXR0X2NvbnRhaW5lci5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2NvbnRhaW5lcl9zcGxpdHRlciA9IHJlcXVpcmUoJy4vYmF0dF9jb250YWluZXJfc3BsaXR0ZXIuanMnKTtcbmJhdHRfY29udGFpbmVyX3NwbGl0dGVyLnByb3RvdHlwZSA9IG5ldyBiYXR0X2NvbnRhaW5lcigpO1xuXG52YXIgYmF0dF9mZWVkID0gcmVxdWlyZSgnLi9iYXR0X2ZlZWQuanMnKTtcbmJhdHRfZmVlZC5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcbnZhciBiYXR0X2ZlZWRfYmF0dCA9IHJlcXVpcmUoJy4vYmF0dF9mZWVkX2JhdHQuanMnKTtcbmJhdHRfZmVlZF9iYXR0LnByb3RvdHlwZSA9IG5ldyBiYXR0X2ZlZWQoKTtcblxudmFyIGJhdHRfZHJvcGRvd24gPSByZXF1aXJlKCcuL2JhdHRfZHJvcGRvd24uanMnKTtcbmJhdHRfZHJvcGRvd24ucHJvdG90eXBlID0gbmV3IGJhdHRfY29udGFpbmVyKCk7XG52YXIgYmF0dF9mb3JtID0gcmVxdWlyZSgnLi9iYXR0X2Zvcm0uanMnKTtcbmJhdHRfZm9ybS5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcbnZhciBiYXR0X3JlZmVyZW5jZSA9IHJlcXVpcmUoJy4vYmF0dF9yZWZlcmVuY2UuanMnKTtcbmJhdHRfcmVmZXJlbmNlLnByb3RvdHlwZSA9IG5ldyBiYXR0X2NvbnRhaW5lcigpO1xudmFyIGJhdHRfdGFibGUgPSByZXF1aXJlKCcuL2JhdHRfdGFibGUuanMnKTtcbmJhdHRfdGFibGUucHJvdG90eXBlID0gbmV3IGJhdHRfY29udGFpbmVyKCk7XG52YXIgYmF0dF90YWJzID0gcmVxdWlyZSgnLi9iYXR0X3RhYnMuanMnKTtcbmJhdHRfdGFicy5wcm90b3R5cGUgPSBuZXcgYmF0dF9jb250YWluZXIoKTtcblxudmFyIGJhdHRfaW5wdXQgPSByZXF1aXJlKCcuL2JhdHRfaW5wdXQuanMnKTtcbmJhdHRfaW5wdXQucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9sYWJlbCA9IHJlcXVpcmUoJy4vYmF0dF9sYWJlbC5qcycpO1xuYmF0dF9sYWJlbC5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X3N0cmluZyA9IHJlcXVpcmUoJy4vYmF0dF9zdHJpbmcuanMnKTtcbmJhdHRfc3RyaW5nLnByb3RvdHlwZSA9IG5ldyBiYXR0X2lucHV0KCk7XG52YXIgYmF0dF9udW1iZXIgPSByZXF1aXJlKCcuL2JhdHRfbnVtYmVyLmpzJyk7XG5iYXR0X251bWJlci5wcm90b3R5cGUgPSBuZXcgYmF0dF9pbnB1dCgpO1xudmFyIGJhdHRfdGV4dCA9IHJlcXVpcmUoJy4vYmF0dF90ZXh0LmpzJyk7XG5iYXR0X3RleHQucHJvdG90eXBlID0gbmV3IGJhdHRfaW5wdXQoKTtcblxudmFyIGJhdHRfZmlsZSA9IHJlcXVpcmUoJy4vYmF0dF9maWxlLmpzJyk7XG5iYXR0X2ZpbGUucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG52YXIgYmF0dF9oZWFkaW5nID0gcmVxdWlyZSgnLi9iYXR0X2hlYWRpbmcuanMnKTtcbmJhdHRfaGVhZGluZy5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2h0bWwgPSByZXF1aXJlKCcuL2JhdHRfaHRtbC5qcycpO1xuYmF0dF9odG1sLnByb3RvdHlwZSA9IG5ldyBiYXR0X29iamVjdCgpO1xuXG52YXIgYmF0dF9saW5rID0gcmVxdWlyZSgnLi9iYXR0X2xpbmsuanMnKTtcbmJhdHRfbGluay5wcm90b3R5cGUgPSBuZXcgYmF0dF9vYmplY3QoKTtcbnZhciBiYXR0X2J1dHRvbiA9IHJlcXVpcmUoJy4vYmF0dF9idXR0b24uanMnKTtcbmJhdHRfYnV0dG9uLnByb3RvdHlwZSA9IG5ldyBiYXR0X2xpbmsoKTtcbnZhciBiYXR0X3RhZyA9IHJlcXVpcmUoJy4vYmF0dF90YWcuanMnKTtcbmJhdHRfdGFnLnByb3RvdHlwZSA9IG5ldyBiYXR0X2xpbmsoKTtcblxudmFyIGJhdHRfdW5rbm93biA9IHJlcXVpcmUoJy4vYmF0dF91bmtub3duLmpzJyk7XG5iYXR0X3Vua25vd24ucHJvdG90eXBlID0gbmV3IGJhdHRfb2JqZWN0KCk7XG4vLyB9fX1cbi8vIFJFUVVJUkUgLSBUaGlyZCBwYXJ0eSBtb2R1bGVzIHt7e1xudmFyIE11c3RhY2hlID0gcmVxdWlyZSgnbXVzdGFjaGUnKTtcbi8vIH19fVxuXG5nbG9iYWwuYmF0dCA9IHtcblx0ZGVidWc6IHRydWUsIC8vIFRoaXMgaXMgY2hhbmdlZCBkdXJpbmcgc2NyaXB0IGNvbXBpbGUgdG8gRkFMU0Vcblx0Zm9ybXM6IHt9LFxuXHR1c2VzUGF0aDogJycsIC8vIEFzc3VtZSBjdXJyZW50IGRpcmVjdG9yeSBpcyB3aGVyZSB3ZSBmaW5kICd1c2VzJyBtb2R1bGVzXG5cdGlzUmVhZHk6IGZhbHNlLFxuXHRzZXRzOiBbXSxcblx0c3RvcDogZmFsc2UsXG5cblx0ZmVlZHM6IHt9LFxuXG5cdHdpZGdldHM6IHtcblx0XHRidXR0b246IHtpbmhlcml0czogJ2xpbmsnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9idXR0b24uanMnKX0sXG5cdFx0Y2hlY2tib3g6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2NoZWNrYm94LmpzJyl9LFxuXHRcdGNob2ljZToge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfY2hvaWNlLmpzJyl9LFxuXHRcdGNob2ljZV9yYWRpbzoge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfY2hvaWNlX3JhZGlvLmpzJyl9LFxuXHRcdGNvbnRhaW5lcjoge2luaGVyaXRzOiAnb2JqZWN0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfY29udGFpbmVyLmpzJyl9LFxuXHRcdGNvbnRhaW5lcl9zcGxpdHRlcjoge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfY29udGFpbmVyX3NwbGl0dGVyLmpzJyl9LFxuXHRcdGRhdGU6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2RhdGUuanMnKX0sXG5cdFx0ZHJvcGRvd246IHtpbmhlcml0czogJ2NvbnRhaW5lcicsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2Ryb3Bkb3duLmpzJyl9LFxuXHRcdGVtYWlsOiB7aW5oZXJpdHM6ICdpbnB1dCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2VtYWlsLmpzJyl9LFxuXHRcdGZlZWRfYmF0dDoge2luaGVyaXRzOiAnZmVlZCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2ZlZWRfYmF0dC5qcycpfSxcblx0XHRmZWVkOiB7aW5oZXJpdHM6ICdjb250YWluZXInLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9mZWVkLmpzJyl9LFxuXHRcdGZpbGU6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2ZpbGUuanMnKX0sXG5cdFx0Zm9ybToge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfZm9ybS5qcycpfSxcblx0XHRoZWFkaW5nOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9oZWFkaW5nLmpzJyl9LFxuXHRcdGh0bWw6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2h0bWwuanMnKX0sXG5cdFx0aW5wdXQ6IHtpbmhlcml0czogJ29iamVjdCcsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X2lucHV0LmpzJyl9LFxuXHRcdGxhYmVsOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9sYWJlbC5qcycpfSxcblx0XHRsaW5rOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9saW5rLmpzJyl9LFxuXHRcdG51bWJlcjoge2luaGVyaXRzOiAnaW5wdXQnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9udW1iZXIuanMnKX0sXG5cdFx0b2JqZWN0OiB7b2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfb2JqZWN0LmpzJyl9LFxuXHRcdHJlZmVyZW5jZToge2luaGVyaXRzOiAnY29udGFpbmVyJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfcmVmZXJlbmNlLmpzJyl9LFxuXHRcdHN0cmluZzoge2luaGVyaXRzOiAnaW5wdXQnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF9zdHJpbmcuanMnKX0sXG5cdFx0dGFibGU6IHtpbmhlcml0czogJ2NvbnRhaW5lcicsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X3RhYmxlLmpzJyl9LFxuXHRcdHRhYnM6IHtpbmhlcml0czogJ2NvbnRhaW5lcicsIG9iamVjdDogcmVxdWlyZSgnLi9iYXR0X3RhYnMuanMnKX0sXG5cdFx0dGFnOiB7aW5oZXJpdHM6ICdsaW5rJywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfdGFnLmpzJyl9LFxuXHRcdHRleHQ6IHtpbmhlcml0czogJ2lucHV0Jywgb2JqZWN0OiByZXF1aXJlKCcuL2JhdHRfdGV4dC5qcycpfSxcblx0XHR1bmtub3duOiB7aW5oZXJpdHM6ICdvYmplY3QnLCBvYmplY3Q6IHJlcXVpcmUoJy4vYmF0dF91bmtub3duLmpzJyl9XG5cdH0sXG5cblx0LyoqXG5cdCogVmFyaWFibGVzIGF2YWlsYWJsZSB0byBvYmplY3QucGFyc2UoKVxuXHQqIEB2YXIgaGFzaFxuXHQqL1xuXHRwYXJzZUdsb2JhbHM6IHtcblx0XHQvKipcblx0XHQqIEV4dHJhY3RzIGEgVVJMIHNlZ21lbnQgdXNpbmcgYSBtYW5nbGVkIHZlcnNpb24gb2YgYSBnbG9iXG5cdFx0KiBcblx0XHQqIFRva2Vuczpcblx0XHQqXHQtICcqJyAtIE1hdGNoIGFueSBudW1iZXIgb2YgY2hhcmFjdGVyc1xuXHRcdCpcdC0gJz8nIC0gTWF0Y2ggb25lIGNocmFjdGVyXG5cdFx0Klx0LSAnIScgLSBDYXB0dXJlIHRoaXNcblx0XHQqXG5cdFx0KiBFeGFtcGxlczpcblx0XHQqXHQtIHt7I3VybH19L3VzZXJzLyF7ey91cmx9fVxuXHRcdCpcdC0ge3sjdXJsfX0vcGF0aC90by9kaXIvIXt7L3VybH19XG5cdFx0Klx0LSB7eyN1cmx9fS91c2Vycy90eXBlLyogL3VzZXJpZCF7ey91cmx9fSAoc3BhY2UgYWRkZWQgYWZ0ZXIgJyonIHNvIG5vdCB0byB1cHNldCBzeW50YXggcGFyc2VycyB0aGF0IHNlZSBpdCBhcyBlbmQtb2YtY29tbWVudHMpXG5cdFx0Ki9cblx0XHR1cmw6IGZ1bmN0aW9uKHRleHQsIHJlbmRlcikgeyAvLyBVcmwgZXh0cmFjdG9yIGZ1bmN0aW9uIC0gZS5nLiBcblx0XHRcdHJldHVybiBmdW5jdGlvbih0ZXh0LCByZW5kZXIpIHtcblx0XHRcdFx0dmFyIHJlU3RyID0gdGV4dFxuXHRcdFx0XHRcdC5yZXBsYWNlKCcqJywgJzxGSUxURVI6QU5ZPicpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJz8nLCAnPEZJTFRFUjpPTkU+Jylcblx0XHRcdFx0XHQucmVwbGFjZSgnIScsICc8RklMVEVSOkNBUFRVUkU+Jylcblx0XHRcdFx0XHQucmVwbGFjZSgvKFsuPyorXiRbXFxdXFwvXFxcXCgpe318LV0pL2csIFwiXFxcXCQxXCIpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJzxGSUxURVI6QU5ZPicsICcuKicpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJzxGSUxURVI6T05FPicsICcuJylcblx0XHRcdFx0XHQucmVwbGFjZSgnPEZJTFRFUjpDQVBUVVJFPicsICcoLiopJyk7XG5cdFx0XHRcdHZhciByZSA9IG5ldyBSZWdFeHAocmVTdHIpO1xuXHRcdFx0XHR2YXIgZm91bmQgPSByZS5leGVjKGRvY3VtZW50LmxvY2F0aW9uLnBhdGhuYW1lKTtcblx0XHRcdFx0dmFyIGJpdCA9IGZvdW5kWzFdIHx8ICcnO1xuXHRcdFx0XHRyZXR1cm4gYml0O1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHRyZWFkeTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5pc1JlYWR5ID0gdHJ1ZTtcblxuXHRcdCQuZWFjaCh0aGlzLnNldHMsIGZ1bmN0aW9uKGksIHNldCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ1RyaWdnZXIgbG9hZCBvZicsIHNldCk7XG5cdFx0XHRpZiAoc2V0LmVsZW1lbnQpIHsgLy8gTG9hZCBpbnRvIGVsZW1lbnQgaS5lLiBpbnZva2UgJChlbGVtZW50KS5iYXR0KGNvbnRlbnQpXG5cdFx0XHRcdHNldC5lbGVtZW50LmJhdHQoc2V0LmNvbnRlbnQpO1xuXHRcdFx0fSBlbHNlIC8vIE5vIGVsZW1lbnQgLSBwcm9iYWJseSBhbiBhbm9ueW1vdXMgbG9hZCAoaS5lLiBiYXR0LnNldChjb250ZW50KSlcblx0XHRcdFx0YmF0dC5zZXQoc2V0LmNvbnRlbnQpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5zZXRzID0gW107XG5cdH0sXG5cblx0bWFrZU9iamVjdDogZnVuY3Rpb24odHlwZSkge1xuXHRcdHZhciBvYmo7XG5cdFx0dHlwZSA9IHR5cGUucmVwbGFjZSgnLScsICdfJyk7XG5cdFx0aWYgKCFiYXR0LndpZGdldHNbdHlwZV0pIHtcblx0XHRcdG9iaiA9IGJhdHQubWFrZU9iamVjdCgndW5rbm93bicpO1xuXHRcdFx0b2JqLnR5cGVGYWlsZWQgPSB0eXBlO1xuXHRcdFx0cmV0dXJuIG9iajtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGJhdHQud2lkZ2V0c1t0eXBlXS5pbmhlcml0cylcblx0XHRcdFx0YmF0dC53aWRnZXRzW3R5cGVdLm9iamVjdC5wcm90b3R5cGUgPSBuZXcgYmF0dC53aWRnZXRzW2JhdHQud2lkZ2V0c1t0eXBlXS5pbmhlcml0c10ub2JqZWN0KCk7XG5cdFx0XHRvYmogPSBuZXcgYmF0dC53aWRnZXRzW3R5cGVdLm9iamVjdCgpO1xuXHRcdH1cblx0XHRvYmoudHlwZSA9IHR5cGU7XG5cdFx0aWYgKGJhdHQud2lkZ2V0c1t0eXBlXS5pbmhlcml0cykgeyAvLyBHbHVlIHByb3RvdHlwZSBhY2Nlc3NvciB0byAuc3VwZXJcblx0XHRcdHZhciBwcm90byA9IG5ldyBiYXR0LndpZGdldHNbYmF0dC53aWRnZXRzW3R5cGVdLmluaGVyaXRzXS5vYmplY3QoKTtcblx0XHRcdG9iai5zdXBlciA9IHByb3RvO1xuXHRcdH1cblx0XHRyZXR1cm4gb2JqO1xuXHR9LFxuXG5cdC8qKlxuXHQqIExvYWQgYSBCYXR0IHBsdWdpbiBmcm9tIHBsdWdpbnMvJG5hbWUuanNcblx0KiBUaGlzIGlzIHJlYWxseSBqdXN0IGEgZHVtYiB3cmFwcGVyIGZvciAkc2NyaXB0KClcblx0KiBAcGFyYW0gc3RyaW5nfGFycmF5IG5hbWUgRWl0aGVyIGEgc2luZ2xlIHBsdWdpbiB0byBsb2FkIG9yIGFuIGFycmF5IG9mIHBsdWdpbnMgdG8gbG9hZFxuXHQqL1xuXHRwbHVnaW46IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRpZiAodHlwZW9mIG5hbWUgPT0gJ2FycmF5JykgeyAvLyBHaXZlbiBhbiBhcnJheSAtIG92ZXJsb2FkIHRvIGluZGl2aWR1YWwgY2FsbHNcblx0XHRcdGZvciAodmFyIHAgaW4gbmFtZSlcblx0XHRcdFx0YmF0dC5wbHVnaW4obmFtZVtwXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUubG9nKCdCYXR0PiBMb2FkaW5nIHBsdWdpbiAnLCBuYW1lKTtcblx0XHRcdCRzY3JpcHQoYmF0dC5wYXRoICsgJy9wbHVnaW5zLycgKyBuYW1lICsgJy5qcycpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0KiBMb2FkIGdlbmVyaWMgQmF0dCBzcGVjIGludG8gYW4gYW5vbnltb3VzIG9iamVjdFxuXHQqIFRoaXMgd2lsbCBuZXZlciBhY3R1YWxseSBhcHBlYXIuIEl0cyBtb3N0bHkgdXNlZCB0byBsb2FkIGRiLXRhYmxlIHdpZGdldHMgZXRjXG5cdCogQHBhcmFtIHN0cmluZyBqc29uIFRoZSBCYXR0IG9iamVjdCBzcGVjIHRvIGxvYWRcblx0Ki9cblx0c2V0OiBmdW5jdGlvbihqc29uKSB7XG5cdFx0dmFyIGlkID0gYmF0dC5nZXRVbmlxdWVJZCgnYmF0dC1mb3JtLScpO1xuXHRcdGlmIChiYXR0LmlzUmVhZHkpIHtcblx0XHRcdGJhdHQuZm9ybXNbaWRdID0gbmV3IGJhdHRfZm9ybSgpO1xuXHRcdFx0YmF0dC5mb3Jtc1tpZF0udHlwZSA9ICdmb3JtJztcblx0XHRcdGJhdHQuZm9ybXNbaWRdLnNldChqc29uKTtcblx0XHR9IGVsc2UgeyAvLyBOb3QgeWV0IHJlYWR5XG5cdFx0XHRjb25zb2xlLmxvZygnQmF0dCBub3QgeWV0IHJlYWR5LiBEZWZlcmVkIGxvYWQgZm9yIGFub255bW91cyBvYmplY3QnLCBpZCk7XG5cdFx0XHRiYXR0LnNldHMucHVzaCh7XG5cdFx0XHRcdGNvbnRlbnQ6IGpzb25cblx0XHRcdH0pO1xuXHRcdH1cblx0fSxcblxuXHRmaW5kOiBmdW5jdGlvbihpZCkge1xuXHRcdGlmIChiYXR0LmZvcm1zW2lkXSkgLy8gSXMgdGhlIElEIGFuIGFjdHVhbCBmb3JtP1xuXHRcdFx0cmV0dXJuIGJhdHQuZm9ybXNbaWRdO1xuXG5cdFx0Zm9yICh2YXIgZiBpbiBiYXR0LmZvcm1zKSB7IC8vIE5vcGUuIFJlY3Vyc2UgaW50byBlYWNoIGZvcm1cblx0XHRcdHZhciBmb3VuZCA9IGJhdHQuZm9ybXNbZl0uZmluZChpZCk7XG5cdFx0XHRpZiAoZm91bmQpXG5cdFx0XHRcdHJldHVybiBmb3VuZDtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCogU2ltcGxlIHdyYXBwZXIgdG8gcnVuIGEgZnVuY3Rpb24gb24gQUxMIGJhdHQgb2JqZWN0c1xuXHQqIFRoaXMgaXMgcmVhbGx5IGp1c3QgYSBkdW1iIHdyYXBwZXIgZm9yIHJ1bm5pbmcgLmVhY2hDaGlsZCBvbiBhbGwgaXRlbXMgaW4gdGhlIGJhdHQuZm9ybXMgaGFzaFxuXHQqIEBwYXJhbSBjYWxsYmFjayBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuLiBDYWxsZWQgaW4gdGhlIGZvcm1hdCBmdW5jdGlvbigpIHt9IHNldHRpbmcgJ3RoaXMnIHRvIHRoZSBjdXJyZW50IGNvbnRleHRcblx0KiBAcGFyYW0gaGFzaCBvcHRpb25zIEEgaGFzaCBvZiBvcHRpb25zIHRvIHVzZSB3aGVuIGZpbHRlcmluZ1xuXHQqIEBzZWUgYmF0dF9jb250YWluZXIvZWFjaENoaWxkKClcblx0Ki9cblx0ZWFjaENoaWxkOiBmdW5jdGlvbihjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGZvciAodmFyIGYgaW4gYmF0dC5mb3Jtcykge1xuXHRcdFx0aWYgKGJhdHQuZm9ybXNbZl0uZWFjaENoaWxkKGNhbGxiYWNrLCBvcHRpb25zKSA9PT0gZmFsc2UpXG5cdFx0XHRcdHJldHVybjtcblx0XHR9XG5cdH0sXG5cblx0c3VibWl0OiBmdW5jdGlvbigpIHtcblx0XHRmb3IgKHZhciBmIGluIGJhdHQuZm9ybXMpIHtcblx0XHRcdGJhdHQuZm9ybXNbZl0uc3VibWl0KCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQqIFNjcmlwdHMgdGhhdCBsb2FkU2NyaXB0cygpIGlzIHdhaXRpbmcgb24uXG5cdCogVGhlc2UgYXJlIHVzdWFsbHkgZnJvbSB0YWdzIHNwZWNpZmllZCB1c2luZyAnc3JjPVwicGF0aFwiJyBpbiB0aGUgdGFnXG5cdCogQGFjY2VzcyBwcml2YXRlXG5cdCovXG5cdGxvYWRTY3JpcHRzU3JjOiB7fSxcblxuXHQvKipcblx0KiBTY3JpcHRzIHRoYXQgYXJlIHdhaXRpbmcgdG8gbG9hZCBmcm9tIHRoaXMgZG9jdW1lbnQuXG5cdCogU2ltaWxhciB0byBsb2FkU2NyaXB0c1NyYyBleGNlcHQgd2UgaGF2ZSB0aGVzZSBmcm9tIGlubGluZVxuXHQqIEBhY2Nlc3MgcHJpdmF0ZVxuXHQqL1xuXHRsb2FkU2NyaXB0c0lubGluZTogW10sXG5cblx0LyoqXG5cdCogSW5mb3JtYXRpb24gYWJvdXQgdGhlIHNjcmlwdCBjdXJyZW50bHkgYmVpbmcgZXZhbCgpJ2VkXG5cdCogVGhpcyBpcyB1c2VkIGJ5IHRoZSAkKHdpbmRvdykub24oJ2Vycm9yJykgaGFuZGxlciB0byBkaXNwbGF5IGEgbmljZSBtZXNzYWdlIHJhdGhlciB0aGFuIGp1c3QgZ2l2aW5nIHVwXG5cdCogQHZhciBhcnJheVxuXHQqIEBhY2Nlc3MgcHJpdmF0ZVxuXHQqL1xuXHRldmFsSW5mbzogbnVsbCxcblxuXHQvKipcblx0KiBQcm9jZXNzIGFsbCA8c2NyaXB0IHR5cGU9XCJiYXR0XCIgW3NyYz1cInBhdGhcIl0vPiB0YWdzXG5cdCovXG5cdGxvYWRTY3JpcHRzOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcmVhZHkgPSAxO1xuXHRcdCQoJ3NjcmlwdFt0eXBlPVwiYmF0dFwiXScpLmVhY2goZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgc2NyaXB0ID0gJCh0aGlzKTtcblx0XHRcdHZhciBzY3JpcHRTcmMgPSBzY3JpcHQuYXR0cignc3JjJyk7XG5cdFx0XHRpZiAoc2NyaXB0U3JjKSB7IC8vIEhhcyBhbiBzcmM9XCJwYXRoXCIgYXR0cmlidXRlXG5cdFx0XHRcdGlmIChiYXR0LmxvYWRTY3JpcHRzU3JjW3NjcmlwdFNyY10gPT0gJ2xvYWRpbmcnKSB7IC8vIFN0aWxsIHdhaXRpbmcgZm9yIHRoaXMgc2NyaXB0IHRvIGxvYWRcblx0XHRcdFx0XHRyZWFkeSA9IDA7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYmF0dC5sb2FkU2NyaXB0c1NyY1tzY3JpcHRTcmNdID09ICdsb2FkZWQnKSB7IC8vIExvYWRlZCBjb250ZW50IC0gdGhpcyBzY3JpcHQgaXMgcmVhZHlcblx0XHRcdFx0XHQvLyBEbyBub3RoaW5nXG5cdFx0XHRcdH0gZWxzZSBpZiAoIWJhdHQubG9hZFNjcmlwdHNTcmNbc2NyaXB0U3JjXSkgeyAvLyBGaXJzdCBtZW50aW9uIG9mIHRoaXMgc2NyaXB0IHdlJ3ZlIHNlZW4gLSB0cmlnZ2VyIEFKQVggbG9hZFxuXHRcdFx0XHRcdGJhdHQubG9hZFNjcmlwdHNTcmNbc2NyaXB0U3JjXSA9ICdsb2FkaW5nJztcblx0XHRcdFx0XHQkLmFqYXgoe1xuXHRcdFx0XHRcdFx0dXJsOiBzY3JpcHRTcmMsXG5cdFx0XHRcdFx0XHRkYXRhVHlwZTogJ3RleHQnLFxuXHRcdFx0XHRcdFx0dHlwZTogJ0dFVCcsXG5cdFx0XHRcdFx0XHRkYXRhOiB7bm9oZWFkZXJzOiAxfSxcblx0XHRcdFx0XHRcdGNhY2hlOiB0cnVlLFxuXHRcdFx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oaHRtbCkge1xuXHRcdFx0XHRcdFx0XHRiYXR0LmxvYWRTY3JpcHRzU3JjW3NjcmlwdFNyY10gPSAnbG9hZGVkJztcblx0XHRcdFx0XHRcdFx0c2NyaXB0LnJlcGxhY2VXaXRoKGh0bWwpO1xuXHRcdFx0XHRcdFx0XHRiYXR0LmxvYWRTY3JpcHRzKCk7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZXJyb3I6IGZ1bmN0aW9uKGpxeGhyLCBlcnJUZXh0LCBlcnJUaHJvd24pIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCdFcnJvciB3aGlsZSBsb2FkaW5nIDxzY3JpcHQgc3JjPVwiJyArIHNjcmlwdFNyYyArICdcIi8+JywgZXJyVGV4dCwgZXJyVGhyb3duKTsgLy8gRklYTUU6IGRlYWwgd2l0aCB0aGlzIGdyYWNlZnVsbHlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZWFkeSA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7IC8vIExvYWQgZnJvbSBjb250ZW50XG5cdFx0XHRcdHZhciBuZXdJZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2JhdHQtJyk7XG5cdFx0XHRcdHNjcmlwdC5iZWZvcmUoJzxkaXYgaWQ9XCInICsgbmV3SWQgKyAnXCI+PC9kaXY+Jylcblx0XHRcdFx0dmFyIGZvcm0gPSB7YWN0aW9uOiBzY3JpcHQuYXR0cignYWN0aW9uJyl9O1xuXHRcdFx0XHRiYXR0LmxvYWRTY3JpcHRzSW5saW5lLnB1c2goXG5cdFx0XHRcdFx0JyQoXFwnIycgKyBuZXdJZCArICdcXCcpLmJhdHQoJyArIHNjcmlwdC5odG1sKCkgKyAnLCAnICsgSlNPTi5zdHJpbmdpZnkoZm9ybSkgKyAnKTsnXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHNjcmlwdC5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAocmVhZHkpIHtcblx0XHRcdC8vIEluc3RhbGwgZ2xvYmFsIGVycm9yIGhhbmRsZXIge3t7XG5cdFx0XHRpZiAoJC5icm93c2VyLmNocm9tZSkge1xuXHRcdFx0XHQkKHdpbmRvdykub24oJ2Vycm9yJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRcdGJhdHQuZ2xvYmFsRXJyb3JIYW5kbGVyKGUub3JpZ2luYWxFdmVudC5tZXNzYWdlLCBudWxsLCBlLm9yaWdpbmFsRXZlbnQubGluZW5vKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgaWYgKCQuYnJvd3Nlci5tb3ppbGxhKSB7XG5cdFx0XHRcdHdpbmRvdy5vbmVycm9yID0gYmF0dC5nbG9iYWxFcnJvckhhbmRsZXI7XG5cdFx0XHR9XG5cdFx0XHQvLyB9fX1cblx0XHRcdGZvciAodmFyIGkgPSBiYXR0LmxvYWRTY3JpcHRzSW5saW5lLmxlbmd0aCAtIDE7IGkgPiAtMTsgaS0tKSB7XG5cdFx0XHRcdHZhciBtYXRjaGVzID0gL1xcJFxcKCcoLiopJ1xcKVxcLmJhdHRcXCgvLmV4ZWMoYmF0dC5sb2FkU2NyaXB0c0lubGluZVtpXSk7XG5cdFx0XHRcdGJhdHQuZXZhbEluZm8gPSB7XG5cdFx0XHRcdFx0bG9hZFNjcmlwdHNJbmxpbmVPZmZzZXQ6IGksXG5cdFx0XHRcdFx0aWQ6IG1hdGNoZXNbMV1cblx0XHRcdFx0fTtcblx0XHRcdFx0ZXZhbChiYXR0LmxvYWRTY3JpcHRzSW5saW5lW2ldKTtcblx0XHRcdH1cblx0XHRcdGJhdHQuZXZhbEluZm8gPSBudWxsO1xuXHRcdFx0YmF0dC5sb2FkU2NyaXB0c0lubGluZSA9IFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmxvZygnSW5saW5lIDxzY3JpcHQ+IHRhZ3Mgd2FpdGluZyBvbicsIE9iamVjdC5rZXlzKGJhdHQubG9hZFNjcmlwdHNTcmMpKTtcblx0XHR9XG5cdH0sXG5cblx0Ly8gU3BlY2lhbCBmdW5jdGlvbnMge3t7XG5cdGdsb2JhbEVycm9ySGFuZGxlcjogZnVuY3Rpb24obWVzc2FnZSwgZmlsZSwgbGluZSkge1xuXHRcdGJhdHQuc3RvcCA9IDE7XG5cdFx0aWYgKGJhdHQuZXZhbEluZm8pIHsgLy8gV2UgaGF2ZSBzb21ldGhpbmcgdG8gY29tcGxhaW4gYWJvdXRcblx0XHRcdHZhciBib3ggPSAkKGJhdHQuZXZhbEluZm8uaWQpO1xuXHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSgvXlVuY2F1Z2h0IFN5bnRheEVycm9yOiAvLCAnJyk7XG5cdFx0XHRib3guYXBwZW5kKCc8ZGl2IGNsYXNzPVwiYWxlcnQgYWxlcnQtYmxvY2sgYWxlcnQtZXJyb3JcIj48aDM+QmF0dCBmYWlsZWQgdG8gbG9hZCAtICcgKyBtZXNzYWdlICsgKGxpbmUgPyAnIChMaW5lOiAnICsgbGluZSArICcpJyA6ICcnKSArICc8L2gzPjwvZGl2PicpO1xuXHRcdFx0aWYgKGxpbmUpIHsgLy8gV2UgaGF2ZSBhIHNwZWNpZmljIGxpbmUgbnVtYmVyIHRvIGxvb2sgYXRcblx0XHRcdFx0dmFyIGJsb2NrID0gYmF0dC5sb2FkU2NyaXB0c0lubGluZVtiYXR0LmV2YWxJbmZvLmxvYWRTY3JpcHRzSW5saW5lT2Zmc2V0XS5zcGxpdChcIlxcblwiKTtcblx0XHRcdFx0Ym94LmZpbmQoJ2Rpdi5hbGVydCcpXG5cdFx0XHRcdFx0LmFwcGVuZCgkKCc8cHJlPjwvcHJlPicpLnRleHQoYmxvY2suc2xpY2UoMCwgbGluZSAtIDEpLmpvaW4oXCJcXG5cIikpKVxuXHRcdFx0XHRcdC5hcHBlbmQoJzxkaXYgY2xhc3M9XCJsYWJlbCBsYWJlbC13YXJuaW5nXCI+JyArIG1lc3NhZ2UgKyAnOjwvZGl2PicpXG5cdFx0XHRcdFx0LmFwcGVuZCgkKCc8cHJlIGNsYXNzPVwiYWxlcnRcIj48L3ByZT4nKS50ZXh0KGJsb2NrLnNsaWNlKGxpbmUgLSAxLCBsaW5lKSkpXG5cdFx0XHRcdFx0LmFwcGVuZCgkKCc8cHJlPjwvcHJlPicpLnRleHQoYmxvY2suc2xpY2UobGluZSkuam9pbihcIlxcblwiKSkpO1xuXHRcdFx0XHRcblx0XHRcdH0gZWxzZSB7IC8vIFdlIGhhdmUgbm8gaWRlYSB3aGVyZSB0aGUgZXJyb3Igb2NjdXJlZFxuXHRcdFx0XHRib3guZmluZCgnZGl2LmFsZXJ0JykuYXBwZW5kKFxuXHRcdFx0XHRcdCQoJzxwcmU+PC9wcmU+JykudGV4dChiYXR0LmxvYWRTY3JpcHRzSW5saW5lW2JhdHQuZXZhbEluZm8ubG9hZFNjcmlwdHNJbmxpbmVPZmZzZXRdKVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0Ly8gfX19XG5cdC8vIFV0aWxpdHkgZnVuY3Rpb25zIHt7e1xuXHQvKipcblx0KiBQYXJzZSBhIE11c3RhY2hlIHRlbXBsYXRlXG5cdCogQHBhcmFtIHN0cmluZyBzdHJpbmcgVGhlIHN0cmluZyB0byBwYXJzZSBhbmQgcmV0dXJuXG5cdCogQHBhcmFtIG9iamVjdCBBZGRpdGlvbmFsIG9iamVjdCBkYXRhIHRvIGluY2x1ZGUgaW4gdGhlIHRlbXBsYXRlXG5cdCogQHJldHVybiBzdHJpbmcgVGhlIHBhcnNlZCBzdHJpbmdcblx0Ki9cblx0cGFyc2U6IGZ1bmN0aW9uKHN0cmluZywgZGF0YSkge1xuXHRcdHZhciBkYXRhID0gJC5leHRlbmQoe30sIGJhdHQucGFyc2VHbG9iYWxzLCBkYXRhKTtcblx0XHR2YXIgb3V0ID0gTXVzdGFjaGUucmVuZGVyKHN0cmluZywgZGF0YSk7XG5cdFx0Ly8gY29uc29sZS5sb2coJ0JBVFQuUEFSU0UnLCBzdHJpbmcsICc9Jywgb3V0LCBkYXRhKTtcblx0XHRyZXR1cm4gb3V0O1xuXHR9LFxuXG5cdC8qKlxuXHQqIFNhbml0aXplIGEgc3RyaW5nIGFuZCByZXR1cm4gdGhlIHNhZmUgdmVyc2lvbiBkZXZvaWQgb2YgYW55dGhpbmcgZGFuZ2Vyb3VzXG5cdCogQHBhcmFtIHN0cmluZyB2YWx1ZSBUaGUgc3RyaW5nIHRvIHNhbml0aXplXG5cdCogQHBhcmFtIHN0cmluZyBwcmVmaXggT3B0aW9uYWwgcHJlZml4IHRvIHByZXBlbmQgdG8gdGhlIG91dHB1dFxuXHQqIEByZXR1cm4gc3RyaW5nIFRoZSBzYWZlIHZlcnNpb24gb2YgdGhlIGlucHV0ICd2YWx1ZSdcblx0Ki9cblx0c2FmZVN0cmluZzogZnVuY3Rpb24odmFsdWUsIHByZWZpeCkge1xuXHRcdHJldHVybiAocHJlZml4P3ByZWZpeDonJykgKyB2YWx1ZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05XSsvZywgJy0nKTtcblx0fSxcblxuXHQvKipcblx0KiBSZXR1cm4gYSB1bmlxdWUgSUQgZm9yIGFuIGl0ZW0gYmFzZWQgb24gYSBwcmVmaXhcblx0KiBUaGlzIGlzIHVzdWFsbHkgdXNlZCB0byBhbGxvY2F0ZSBhbiBIVE1MIElEIHRvIGFuIGVsZW1lbnQgdGhhdCBkb2VzbnQgYWxyZWFkeSBoYXZlIG9uZVxuXHQqL1xuXHRnZXRVbmlxdWVJZDogZnVuY3Rpb24ocHJlZml4KSB7XG5cdFx0aWYgKCFwcmVmaXgpXG5cdFx0XHRwcmVmaXggPSAnYmF0dC0nO1xuXHRcdHdoaWxlICgxKSB7XG5cdFx0XHR2YXIgaWQgPSBwcmVmaXggKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqOTk5OTkpO1xuXHRcdFx0aWYgKCQoJyMnICsgaWQpLmxlbmd0aCA9PSAwKVxuXHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0fVxuXHR9XG5cdC8vIH19fVxufTtcblxuYmF0dC5yZWFkeSgpO1xuXG4kLmZuLmV4dGVuZCh7XG5cdC8qKlxuXHQqIENvbnZlbmllbmNlIGNvbnN0cnVjdG9yIHRvIGludm9rZSBCYXR0IG9uIGFuIGVsZW1lbnRcblx0KiBAcGFyYW0gc3RyaW5nIGpzb24gUkFXIEJhdHQgSlNPTiBzcGVpZmljYXRpb25cblx0KiBAcGFyYW0gb2JqZWN0IGZvcm1PYmplY3QgQWRkaXRpb25hbCBwYXJhbWV0ZXJzIHRvIGltcG9ydCB3aGVuIGNyZWF0aW5nIHRoZSB3cmFwcGVyIGZvcm0gZS5nLiB7YWN0aW9uOiAnL3N1Ym1pdC9oZXJlJ31cblx0Ki9cblx0YmF0dDogZnVuY3Rpb24oanNvbiwgZm9ybU9iamVjdCkge1xuXHRcdHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSAkKHRoaXMpO1xuXHRcdFx0dmFyIGlkID0gbWUuYXR0cignaWQnKTtcblx0XHRcdHZhciBjb250ZW50ID0ganNvbiB8fCBtZS50ZXh0KCk7XG5cdFx0XHRpZiAoIWlkKSB7IC8vIE1ha2Ugc3VyZSB0aGUgaXRlbSBoYXMgYW4gSUQgLSBtYWtlIG9uZSBpZiBuZWNlc3Nhcnlcblx0XHRcdFx0aWQgPSBiYXR0LmdldFVuaXF1ZUlkKCdiYXR0LWZvcm0tJyk7XG5cdFx0XHRcdG1lLmF0dHIoJ2lkJywgaWQpXG5cdFx0XHR9XG5cdFx0XHRpZiAoYmF0dC5pc1JlYWR5KSB7XG5cdFx0XHRcdGJhdHQuZm9ybXNbaWRdID0gYmF0dC5tYWtlT2JqZWN0KCdmb3JtJyk7XG5cdFx0XHRcdGJhdHQuZm9ybXNbaWRdLnNldChjb250ZW50KTtcblx0XHRcdFx0aWYgKGZvcm1PYmplY3QpXG5cdFx0XHRcdFx0JC5leHRlbmQoYmF0dC5mb3Jtc1tpZF0sIGZvcm1PYmplY3QpO1xuXHRcdFx0XHRiYXR0LmZvcm1zW2lkXS5zZXR1cC5jYWxsKGJhdHQuZm9ybXNbaWRdLCBtZSk7XG5cdFx0XHRcdGJhdHQuZm9ybXNbaWRdLnJlbmRlci5jYWxsKGJhdHQuZm9ybXNbaWRdKTtcblx0XHRcdH0gZWxzZSB7IC8vIE5vdCB5ZXQgcmVhZHlcblx0XHRcdFx0Y29uc29sZS5sb2coJ0JhdHQgbm90IHlldCByZWFkeS4gRGVmZXJlZCBsb2FkIGZvciBmb3JtJywgaWQpO1xuXHRcdFx0XHRiYXR0LnNldHMucHVzaCh7XG5cdFx0XHRcdFx0ZWxlbWVudDogbWUsXG5cdFx0XHRcdFx0Y29udGVudDogY29udGVudFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufSk7XG5cbi8vIFRyaWdnZXIgaW5pdGlhbCBzd2VlcCBmb3IgPHNjcmlwdCB0eXBlPVwiYmF0dFwiLz4gdGFnc1xuJChiYXR0LmxvYWRTY3JpcHRzKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0Y29udGFpbmVyRHJhdzogJ2J1dHRvbnMnLFxuXHRcdGFjdGlvbjogJ25vdGhpbmcnLFxuXHRcdGNsYXNzZXM6ICdidG4nLFxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnJlbmRlci5jYWxsKHRoaXMpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdoaWRlLWxhYmVsJyxcblx0XHR2YWx1ZTogbnVsbCwgLy8gVmFsdWUgY2FuIG9ubHkgYmUgdmFsdWVDaGVja2VkIChpLmUuIGFueSBib29sZWFuIHRydWUpIG9yIG51bGxcblx0XHR2YWx1ZUNoZWNrZWQ6IDEsIC8vIFRoZSBhY3R1YWwgdmFsdWUgdG8gdHJhbnNtaXQgaWYgY2hlY2tlZFxuXG5cdFx0cmVxdWlyZWQ6IGZhbHNlLFxuXHRcdHJlYWRPbmx5OiBudWxsLFxuXHRcdGVycm9yUmVxdWlyZWQ6ICdTdHJpbmcgcmVxdWlyZWQnLFxuXG5cdFx0Y2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmVsZW1lbnQuZmluZCgnaW5wdXRbdHlwZT1jaGVja2JveF0nKS5pcygnOmNoZWNrZWQnKSA/IHRoaXMudmFsdWVDaGVja2VkIDogbnVsbDtcblx0XHRcdHRoaXMuc3VwZXIuY2hhbmdlLmNhbGwodGhpcyk7XG5cdFx0fSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZVxuXHRcdFx0XHQuZWxlbWVudCA9ICQoJzxsYWJlbCBjbGFzcz1cImNoZWNrYm94XCI+PGlucHV0IHR5cGU9XCJjaGVja2JveFwiLz4gJyArIG1lLnRpdGxlICsgJzwvbGFiZWw+Jylcblx0XHRcdFx0Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRtZS5jaGFuZ2UuY2FsbChtZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIG1lO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmIChtZS52YWx1ZSkge1xuXHRcdFx0XHRtZS5lbGVtZW50LmF0dHIoJ2NoZWNrZWQnLCAnY2hlY2tlZCcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bWUuZWxlbWVudC5yZW1vdmVBdHRyKCdjaGVja2VkJyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtZS5yZWFkT25seSlcblx0XHRcdFx0bWUuZWxlbWVudFxuXHRcdFx0XHRcdC5hdHRyKCdyZWFkb25seScsICdyZWFkb25seScpXG5cblx0XHRcdFx0XHQuYWRkQ2xhc3MoJ2Rpc2FibGVkSW5wdXQnKTtcblx0XHRcdHJldHVybiBtZTtcblx0XHR9LFxuXG5cdFx0dmFsaWRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKHRoaXMucmVxdWlyZWQgJiYgIXRoaXMudmFsdWUpXG5cdFx0XHRcdHJldHVybiB0aGlzLmVycm9yUmVxdWlyZWQ7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzxzZWxlY3Q+PC9zZWxlY3Q+Jyxcblx0XHRjaG9pY2VzOiB7XG5cdFx0XHRmb286ICdGb28nLFxuXHRcdFx0YmFyOiAnQmFyJyxcblx0XHRcdGJhejogJ0Jheidcblx0XHR9LFxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5lbGVtZW50ID0gJChtZS5yZW5kZXJUYWcpO1xuXHRcdFx0bWUuZWxlbWVudC5vbignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdG1lLnZhbHVlID0gJCh0aGlzKS52YWwoKTtcblx0XHRcdFx0bWUuY2hhbmdlLmNhbGwobWUpO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpO1xuXHRcdFx0Zm9yICh2YXIgaWQgaW4gbWUuY2hvaWNlcykge1xuXHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZCgnPG9wdGlvbiB2YWx1ZT1cIicgKyBpZCArICdcIj4nICsgbWUuY2hvaWNlc1tpZF0gKyAnPC9vcHRpb24+Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtZS52YWx1ZSkge1xuXHRcdFx0XHRtZS5lbGVtZW50LnZhbChtZS52YWx1ZSk7XG5cdFx0XHR9IGVsc2UgeyAvLyBObyB2YWx1ZSAtIHNlbGVjdCB0aGUgZmlyc3Rcblx0XHRcdFx0bWUuZWxlbWVudFxuXHRcdFx0XHRcdC52YWwoIG1lLmVsZW1lbnQuZmluZCgnb3B0aW9uOmZpcnN0JykuYXR0cigndmFsdWUnKSApXG5cdFx0XHRcdFx0LnRyaWdnZXIoJ2NoYW5nZScpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzxkaXY+PC9kaXY+Jyxcblx0XHRjaG9pY2VzOiB7fSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuZW1wdHkoKTtcblx0XHRcdGZvciAodmFyIGlkIGluIHRoaXMuY2hvaWNlcykge1xuXHRcdFx0XHR2YXIgbGFiZWwgPSAkKCc8bGFiZWwgY2xhc3M9XCJyYWRpb1wiPjwvbGFiZWw+Jylcblx0XHRcdFx0XHQuYXBwZW5kVG8odGhpcy5lbGVtZW50KTtcblx0XHRcdFx0dmFyIHJhZGlvID0gJCgnPGlucHV0IHR5cGU9XCJyYWRpb1wiIG5hbWU9XCInICsgbWUuaWQgKyAnXCIgdmFsdWU9XCInICsgaWQgKyAnXCI+JyArIHRoaXMuY2hvaWNlc1tpZF0gKyAnPC9sYWJlbD4nKVxuXHRcdFx0XHRcdC5hcHBlbmRUbyhsYWJlbClcblx0XHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0bWUudmFsdWUgPSAkKHRoaXMpLnZhbCgpO1xuXHRcdFx0XHRcdFx0bWUuY2hhbmdlLmNhbGwobWUpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy52YWx1ZSlcblx0XHRcdFx0dGhpcy5lbGVtZW50LmZpbmQoJ2lucHV0W3ZhbHVlPVwiJyArIHRoaXMudmFsdWUgKyAnXCJdJykucHJvcCgnY2hlY2tlZCcsIHRydWUpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNoaWxkcmVuOiB7fSxcblx0XHRjaGlsZHJlbk9yZGVyOiBbXSxcblx0XHRjb250YWluZXJEcmF3OiAncm93Jyxcblx0XHRpbXBseUNoaWxkOiAndW5rbm93bicsIC8vIERlZmF1bHQgdG8gdGhpcyBpZiBubyBjaGlsZCB0eXBlIGlzIHNwZWNpZmllZFxuXHRcdGRhdGFTb3VyY2U6IG51bGwsIC8vIFdoYXQgZGF0YSBzb3VyY2UgdG8gdXNlICh1c3VhbGx5IGEgaGFzaCBzdHJ1Y3R1cmUpXG5cdFx0cmVuZGVyVGFnOiAnPGRpdj48L2Rpdj4nLCAvLyBXaGF0IHdyYXBwZXIgdG8gdXNlIHdoZW4gZHJhd2luZyB0aGUgY29udGFpbmVyXG5cdFx0Y2xhc3NlczogJycsXG5cblx0XHQvKipcblx0XHQqIFJ1bnMgYSBmdW5jdGlvbiBvbiBlYWNoIGNoaWxkIG9mIHRoaXMgY29udGFpbmVyXG5cdFx0KiBUaGlzIGZ1bmN0aW9uIGlzIHJlY3Vyc2l2ZS4gSWYgeW91IHJlcXVpcmUganVzdCB0aGUgaW1tZWRpYXRlIGNoaWxkcmVuIHVzZSAkLmVhY2goY29udGFpbmVyLmNoaWxkcmVuLCBmdW5jdGlvbigpIHsgfSlcblx0XHQqIEBwYXJhbSBjYWxsYmFjayBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuLiBDYWxsZWQgaW4gdGhlIGZvcm1hdCBmdW5jdGlvbigpIHt9IHNldHRpbmcgJ3RoaXMnIHRvIHRoZSBjdXJyZW50IGNvbnRleHRcblx0XHQqIEBwYXJhbSBoYXNoIG9wdGlvbnMgQSBoYXNoIG9mIG9wdGlvbnMgdG8gdXNlIHdoZW4gZmlsdGVyaW5nXG5cdFx0KiBAcGFyYW0gb2JqZWN0IG9iamVjdCBDb250ZXh0IG9iamVjdCAoaW50ZXJuYWwgdXNlIG9ubHkpXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdGVhY2hDaGlsZDogZnVuY3Rpb24oY2FsbGJhY2ssIG9wdGlvbnMsIGNvbnRleHQpIHtcblx0XHRcdGlmICghY29udGV4dClcblx0XHRcdFx0Y29udGV4dCA9IHRoaXM7XG5cdFx0XHRpZiAoIWNvbnRleHQuY2hpbGRyZW4pXG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0dmFyIHNldHRpbmdzID0gJC5leHRlbmQoe30sIHtcblx0XHRcdFx0YW5kU2VsZjogZmFsc2UsIC8vIEluY2x1ZGUgdGhpcyBpdGVtIGluIHRoZSBmaXJzdCBjYWxsYmFja1xuXHRcdFx0XHRkZXB0aEZpcnN0OiBmYWxzZSAvLyBUcmlnZ2VyIGNhbGxiYWNrcyBmcm9tIHRoZSBkZWVwZXN0IGZpcnN0XG5cdFx0XHR9LCBvcHRpb25zKTtcblxuXHRcdFx0aWYgKHNldHRpbmdzLmFuZFNlbGYgJiYgIXNldHRpbmdzLmRlcHRoRmlyc3QpXG5cdFx0XHRcdGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG5cblx0XHRcdGlmICghY29udGV4dC5jaGlsZHJlbk9yZGVyKVxuXHRcdFx0XHRjb250ZXh0LmNoaWxkcmVuT3JkZXIgPSBPYmplY3Qua2V5cyhjb250ZXh0LmNoaWxkcmVuKTtcblxuXHRcdFx0Zm9yICh2YXIgY2lkIGluIGNvbnRleHQuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHR2YXIgY2hpbGQgPSBjb250ZXh0LmNoaWxkcmVuW2NvbnRleHQuY2hpbGRyZW5PcmRlcltjaWRdXTtcblx0XHRcdFx0aWYgKCFzZXR0aW5ncy5kZXB0aEZpcnN0KVxuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwoY2hpbGQpO1xuXHRcdFx0XHRpZiAoY2hpbGQuY2hpbGRyZW4pXG5cdFx0XHRcdFx0dGhpcy5lYWNoQ2hpbGQuY2FsbChjaGlsZCwgY2FsbGJhY2ssIG9wdGlvbnMsIGNoaWxkKTtcblx0XHRcdFx0aWYgKHNldHRpbmdzLmRlcHRoRmlyc3QpXG5cdFx0XHRcdFx0Y2FsbGJhY2suY2FsbChjaGlsZCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoc2V0dGluZ3MuYW5kU2VsZiAmJiAhc2V0dGluZ3MuZGVwdGhGaXJzdClcblx0XHRcdFx0Y2FsbGJhY2suY2FsbChjb250ZXh0KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIExvY2F0ZSBhIG9iamVjdCBieSBpdHMgSUQgdW5kZXIgdGhpcyBvbmVcblx0XHQqIEBwYXJhbSBzdHJpbmcgaWQgVGhlIElEIG9mIHRoZSBvYmplY3QgdG8gZmluZFxuXHRcdCogQHBhcmFtIG9iamVjdCBjb250ZXh0IEludGVybmFsIHVzZSBvbmx5IC0gcHJvdmlkZSB0aGUgY29udGV4dCB0byBzY2FuXG5cdFx0KiBAcmV0dXJuIG51bGx8b2JqZWN0IEVpdGhlciB0aGUgZm91bmQgb2JqZWN0IG9yIG51bGxcblx0XHQqL1xuXHRcdGZpbmQ6IGZ1bmN0aW9uKGlkLCBjb250ZXh0KSB7XG5cdFx0XHRpZiAoIWNvbnRleHQpXG5cdFx0XHRcdGNvbnRleHQgPSB0aGlzO1xuXG5cdFx0XHRpZiAoIWNvbnRleHQuY2hpbGRyZW4pXG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0aWYgKGNvbnRleHQuY2hpbGRyZW5baWRdKVxuXHRcdFx0XHRyZXR1cm4gY29udGV4dC5jaGlsZHJlbltpZF07XG5cblx0XHRcdGZvciAodmFyIGMgaW4gY29udGV4dC5jaGlsZHJlbikge1xuXHRcdFx0XHR2YXIgZm91bmQgPSB0aGlzLmZpbmQoaWQsIGNvbnRleHQuY2hpbGRyZW5bY10pO1xuXHRcdFx0XHRpZiAoZm91bmQpXG5cdFx0XHRcdFx0cmV0dXJuIGZvdW5kO1xuXHRcdFx0fTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIEV4dHJhY3QgYWxsICd1c2VzJyBkaXJlY3RpdmVzIGZyb20gYSBjb21wbGV4bHkgbmVzdGVkIEpTT04gb2JqZWN0IGFuZCByZXR1cm4gYXMgYW4gYXJyYXlcblx0XHQqIEBwYXJhbSBvYmplY3QganNvbiBUaGUgbmVzdGVkIEpTT04gb2JqZWN0IHRvIHByb2Nlc3Ncblx0XHQqIEByZXR1cm4gYXJyYXkgQW4gYXJyYXkgb2YgYWxsIHVzZXMgZGlyZWN0aXZlc1xuXHRcdCovXG5cdFx0ZGV0ZXJtaW5lVXNlczogZnVuY3Rpb24oanNvbikge1xuXHRcdFx0dmFyIHVzZXMgPSB7fTtcblxuXHRcdFx0dmFyIHVzZXNXb3JrZXIgPSBmdW5jdGlvbihqc29uLCB1c2VzKSB7IFxuXHRcdFx0XHQkLmVhY2goanNvbiwgZnVuY3Rpb24oaSwgaikge1xuXHRcdFx0XHRcdGlmIChqLmNoaWxkcmVuKVxuXHRcdFx0XHRcdFx0dXNlc1dvcmtlcihqLmNoaWxkcmVuLCB1c2VzKVxuXHRcdFx0XHRcdGlmIChqLnVzZXMpXG5cdFx0XHRcdFx0XHR1c2VzW2oudXNlc10gPSAxO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dXNlc1dvcmtlcihqc29uLCB1c2VzKTtcblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyh1c2VzKTtcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBBZGQgYSBuZXcgYmF0dCBvYmplY3QgdG8gYSBjb250YWluZXJcblx0XHQqIE5PVEU6IFRoaXMgd2lsbCBub3QgcmUtcmVuZGVyIHRoZSBwYXJlbnQgeW91IHdpbGwgaGF2ZSB0byBjYWxsIHRoaXMucmVuZGVyKCkgdG8gZG8gdGhhdFxuXHRcdCogQHBhcmFtIG1peGVkIEpTT04gZGF0YSB0aGF0IGRlZmluZXMgdGhlIG9iamVjdFxuXHRcdCogQHBhcmFtIHN0cmluZyB3aGVyZSBPcHRpb25hbCB3aGVyZSBjb25kaXRpb24uIEVudW0gb2Y6ICdsYXN0JyAoZGVmYXVsdCksICdhZnRlcidcblx0XHQqIEBwYXJhbSBzdHJpbmcgaWQgSWYgd2hlcmU9PSdhZnRlcicgdGhpcyBpcyB0aGUgZXhpc3RpbmcgY2hpbGQgdG8gaW5zZXJ0IGFmdGVyLiBJZiB0aGUgY2hpbGQgSUQgaXMgbm90IGZvdW5kIHRoZSBuZXcgaXRlbSBpcyBhcHBlbmRlZFxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRhZGRDaGlsZDogZnVuY3Rpb24ob2JqLCB3aGVyZSwgaWQpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHR2YXIgY2hpbGQgPSBudWxsO1xuXG5cdFx0XHRpZiAoIW9iai51c2VzKSAvLyBJbmhlcml0ICd1c2VzJyBmcm9tIHBhcmVudCBpZiBub3Qgc3BlY2lmaWVkXG5cdFx0XHRcdG9iai51c2VzID0gbWUudXNlcztcblxuXHRcdFx0aWYgKG9iai5pbXBvcnQpIHsgLy8gTm8gdHlwZSBleHBsaWNpdCBidXQgaXQgbG9va3MgbGlrZSB3ZSBhcmUgaW5oZXJpdGluZ1xuXHRcdFx0XHR2YXIgbWF0Y2hlcyA9IC9eKC4qKVxcLiguKikkLy5leGVjKG9iai5pbXBvcnQpO1xuXHRcdFx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0XHRcdHZhciBpbXBvcnRGZWVkID0gbWF0Y2hlc1sxXTtcblx0XHRcdFx0XHR2YXIgaW1wb3J0SWQgPSBtYXRjaGVzWzJdO1xuXHRcdFx0XHRcdGlmICghYmF0dC5mZWVkc1tpbXBvcnRGZWVkXSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCdOb24tZXhpc3RhbnQgZmVlZCB0byBpbXBvcnQgZnJvbS4gRmVlZD0nICsgaW1wb3J0RmVlZCArICcsIElEPScgKyBpbXBvcnRJZCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBlbHNlIGlmICghYmF0dC5mZWVkc1tpbXBvcnRGZWVkXS5jaGlsZHJlbltpbXBvcnRJZF0pIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignTm9uLWV4aXN0YW50IGZlZWQgSUQgdG8gaW1wb3J0IGZyb20uIEZlZWQ9JyArIGltcG9ydEZlZWQgKyAnLCBJRD0nICsgaW1wb3J0SWQgKyAnIChmZWVkIGV4aXN0cyBidXQgY2hpbGQgZG9lcyBub3QpJyk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBlbHNlIHsgLy8gQWxsIGlzIHdlbGxcblx0XHRcdFx0XHRcdGNoaWxkID0gYmF0dC5mZWVkc1tpbXBvcnRGZWVkXS5jaGlsZHJlbltpbXBvcnRJZF07XG5cdFx0XHRcdFx0XHRjaGlsZC5kYXRhQmluZGluZyA9IGltcG9ydElkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHsgLy8gRklYTUU6IFdvdWxkIGJlIG5pY2UgaWYgdGhlcmUgd2VyZSBzb21lIG90aGVyIHdheSBvZiBpbXBvcnRpbmdcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ0ltcG9ydCByZWZlcmVuY2UgXCInICsgb2JqLmltcG9ydCArICdcIiBpcyBpbnZhbGlkLiBGb3JtYXQgbXVzdCBiZSBcImZlZWQuaWRcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCFvYmoudHlwZSAmJiBvYmoudXNlcyAmJiBvYmouaWQgJiYgYmF0dC5mZWVkc1tvYmoudXNlc10uY2hpbGRyZW5bb2JqLmlkXSkgeyAvLyBObyB0eXBlIGV4cGxpY2l0IGJ1dCBpdCBsb29rcyBsaWtlIHdlIGFyZSBpbmhlcml0aW5nXG5cdFx0XHRcdGNvbnNvbGUud2FybignSW5oZXJpdGFuY2UgZnJvbSAudXNlcyBpcyBkZXBjcmVjaWF0ZWQhJyk7XG5cdFx0XHRcdGNoaWxkID0gYmF0dC5mZWVkc1tvYmoudXNlc10uY2hpbGRyZW5bb2JqLmlkXTtcblx0XHRcdH0gZWxzZSB7IC8vIFR5cGUgZXhwbGljaXQgT1Igbm8gdXNlc1xuXHRcdFx0XHRjaGlsZCA9IGJhdHQubWFrZU9iamVjdChvYmoudHlwZSA/IG9iai50eXBlIDogbWUuaW1wbHlDaGlsZCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghb2JqLmlkKSB7IC8vIFNldCB1cCBhbiBJRCAtIGV2ZW4gaWYgb25lIGRvZXNudCBhbHJlYWR5IGV4aXN0XG5cdFx0XHRcdG9iai5pZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2ZpZWxkLScpO1xuXHRcdFx0XHRvYmouaWRGYWtlID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSBpZiAoIW9iai5pZEZha2UgJiYgIW9iai50aXRsZSkgLy8gU2V0IHVwIG5pY2UgbG9va2luZyB0aXRsZSBpZiBkb25lIGRvZXNudCBleGlzdFxuXHRcdFx0XHRvYmoudGl0bGUgPSBvYmouaWQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBvYmouaWQuc3Vic3RyKDEpO1xuXG5cdFx0XHRpZiAob2JqLnVzZXMgJiYgYmF0dC5mZWVkc1tvYmoudXNlc10gJiYgYmF0dC5mZWVkc1tvYmoudXNlc10uY2hpbGRyZW5bb2JqLmlkXSkgeyAvLyBVc2VzIGlzIHNvbWV0aGluZyBBTkQgdGhlcmUgaXMgYSB0YWJsZS9jb2wgcGFpciBtYXRjaGluZyB0aGlzIGRlZmluaXRpb24gLSBpbmhlaXJ0IGZyb20gYmFzZSBjbGFzcyArIHRhYmxlICsgb3B0aW9uc1xuXHRcdFx0XHRjaGlsZCA9IGJhdHQuZmVlZHNbb2JqLnVzZXNdLmNoaWxkcmVuW29iai5pZF07XG5cdFx0XHRcdGNoaWxkLmRhdGFCaW5kaW5nID0gb2JqLnVzZXMgKyAnLicgKyBvYmouaWQ7XG5cdFx0XHRcdCQuZXh0ZW5kKGNoaWxkLCBvYmopO1xuXHRcdFx0fSBlbHNlIC8vIE5vIHVzZXMgZGlyZWN0aXZlIC0ganVzdCBpbmhlcml0IGZyb20gYmFzZSBjbGFzcyArIG9wdGlvbnNcblx0XHRcdFx0JC5leHRlbmQoY2hpbGQsIG9iaik7XG5cblx0XHRcdHN3aXRjaCAod2hlcmUpIHtcblx0XHRcdFx0Y2FzZSAnYWZ0ZXInOlxuXHRcdFx0XHRcdHZhciBleGlzdGluZyA9IG1lLmNoaWxkcmVuT3JkZXIuaW5kZXhPZihpZCk7XG5cdFx0XHRcdFx0aWYgKCFpZCkgeyBcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignYmF0dF9jb250YWluZXIuYWRkQ2hpbGQob2JqZWN0LCBcImFmdGVyXCIsIFwiJyArIGlkICsgJ1wiKT4gQXNrZWQgdG8gaW5zZXJ0IGFmdGVyIG5vbi1leGlzdGFudCBpZCBcIicgKyBpZCArICdcIi4gSW5zZXJ0aW5nIGF0IGVuZCBpbnN0ZWFkJyk7XG5cdFx0XHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyLnB1c2goY2hpbGQuaWQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyLnNwbGljZShleGlzdGluZyArIDEsIDAsIGNoaWxkLmlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ2xhc3QnOlxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIucHVzaChjaGlsZC5pZCk7XG5cdFx0XHR9XG5cdFx0XHRtZS5jaGlsZHJlbltjaGlsZC5pZF0gPSBjaGlsZDtcblx0XHRcdGNoaWxkLnNldHVwKCk7XG5cblx0XHRcdGlmIChjaGlsZC5jaGlsZHJlbikgLy8gSW5pdGFsaXplIGFsbCBjaGlsZHJlblxuXHRcdFx0XHRjaGlsZC5zZXQoY2hpbGQuY2hpbGRyZW4sIHRydWUpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUmVtb3ZlIGEgY2hpbGQgb2JqZWN0IGJ5IGl0cyBJRFxuXHRcdCogQHBhcmFtIHN0cmluZyBpZCBUaGUgSUQgb2YgdGhlIGNoaWxkIHRvIHJlbW92ZVxuXHRcdCogQHJldHVybiBvYmplY3QgVGhpcyBjaGFpbmFibGUgb2JqZWN0XG5cdFx0Ki9cblx0XHRyZW1vdmVDaGlsZDogZnVuY3Rpb24oaWQpIHtcblx0XHRcdHZhciBleGlzdGluZyA9IHRoaXMuY2hpbGRyZW5PcmRlci5pbmRleE9mKGlkKTtcblx0XHRcdGlmICghaWQpIHsgXG5cdFx0XHRcdGNvbnNvbGUud2FybignYmF0dF9jb250YWluZXIucmVtb3ZlQ2hpbGQoXCInICsgaWQgKyAnXCIpPiBBc2tlZCB0byByZW1vdmUgbm9uLWV4aXN0YW50IGlkIFwiJyArIGlkICsgJ1wiJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNoaWxkcmVuT3JkZXIuc3BsaWNlKGV4aXN0aW5nLCAxKTtcblx0XHRcdFx0ZGVsZXRlIHRoaXMuY2hpbGRyZW5baWRdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogVGFrZSBhIGNvbXBsZXggSlNPTiBhcnJheSBhbmQgY2FsbCBhZGQoKSBvbiBlYWNoIGl0ZW1cblx0XHQqIFRoaXMgZnVuY3Rpb24gYWxzbyBjbGVhcnMgdGhlIGV4aXN0aW5nIGNoaWxkcmVuXG5cdFx0KiBAcGFyYW0gc3RyaW5nIGpzb24gVGhlIEpTT04gb2JqZWN0IHRvIHByb2Nlc3Ncblx0XHQqIEBwYXJhbSBib29sIGlzQ2hpbGQgSW50ZXJuYWwgcHJvcGVydHkgdG8gcHJldmVudCByZWN1cnNpdmUgJ3VzZXMnIGxvYWRzXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdHNldDogZnVuY3Rpb24oanNvbiwgaXNDaGlsZCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmNoaWxkcmVuID0ge307XG5cdFx0XHRtZS5jaGlsZHJlbk9yZGVyID0gW107XG5cblx0XHRcdC8vIFByZXZlbnQgcmFjZSBjb25kaXRpb24gLSBwcm9jZXNzaW5nIHRyZWUgYmVmb3JlIGNoaWxkLnVzZXMgbW9kdWxlIGxvYWRzIGFyZSByZWFkeSB7e3tcblx0XHRcdGlmICghaXNDaGlsZCkgeyAvLyBNYXN0ZXIgcGFyZW50IGhhcyBhbHJlYWR5IGJlZW4gaW52b2tlZCAtIHdlIGFyZSBwcm9wYmFibHkgaW5zaWRlIGEgcmVjdXJzaXZlIGxvYWRcblx0XHRcdFx0dmFyIG5vbkxvYWRlZFVzZXMgPSBbXTtcblx0XHRcdFx0dmFyIGxvYWRzID0gdGhpcy5kZXRlcm1pbmVVc2VzKGpzb24pO1xuXHRcdFx0XHRmb3IgKHZhciBsIGluIGxvYWRzKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ1JFUVVJUkVTJywgbG9hZHNbbF0sIGJhdHQuZmVlZHNbbG9hZHNbbF1dKTtcblx0XHRcdFx0XHRpZiAoIWJhdHQuZmVlZHNbbG9hZHNbbF1dKVxuXHRcdFx0XHRcdFx0bm9uTG9hZGVkVXNlcy5wdXNoKGJhdHQudXNlc1BhdGggKyBsb2Fkc1tsXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG5vbkxvYWRlZFVzZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0RlZmVyIGxvYWRpbmcgaW50byAnLCBqc29uLCAnIHdhaXQgZm9yIG1vZHVsZXM6Jywgbm9uTG9hZGVkVXNlcyk7XG5cdFx0XHRcdFx0JHNjcmlwdChub25Mb2FkZWRVc2VzLCBmdW5jdGlvbihub3RGb3VuZCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0xPQURFRCBNT0RVTEVTJywgbm9uTG9hZGVkVXNlcywgbm90Rm91bmQpO1xuXHRcdFx0XHRcdFx0aWYgKGJhdHQuc3RvcClcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0bWVcblx0XHRcdFx0XHRcdFx0LnNldChqc29uKVxuXHRcdFx0XHRcdFx0XHQucmVuZGVyKCk7XG5cdFx0XHRcdFx0fSwgZnVuY3Rpb24obm90Rm91bmQpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignQ0FOTk9UIExPQUQgTU9EVUxFUycsIG5vdEZvdW5kKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXG5cdFx0XHQkLmVhY2goanNvbiwgZnVuY3Rpb24oaSwgb2JqKSB7XG5cdFx0XHRcdG1lLmFkZENoaWxkKG9iaik7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFJldHJpZXZlIHRoZSBuZXh0IGRhdGEgcm93IGlmIC5kYXRhU291cmNlIGlzIHNwZWNpZmllZFxuXHRcdCogQHJldHVybiBvYmplY3QgVGhlIGRhdGEgb2JqZWN0IChhbHNvIHNldCBpbiB0aGlzLmRhdGEgZm9yIGNvbnZlbmllbmNlKVxuXHRcdCovXG5cdFx0Z2V0RGF0YTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoIXRoaXMuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyPiBBc2tlZCB0byBnZXREYXRhKCkgYnV0IG5vIGRhdGFTb3VyY2Ugc3BlY2lmaWVkJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldCsrO1xuXHRcdFx0XHRpZiAodGhpcy5kYXRhU291cmNlLmRhdGEgJiYgdGhpcy5kYXRhU291cmNlLmRhdGEucGF5bG9hZCAmJiB0aGlzLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldCA8IHRoaXMuZGF0YVNvdXJjZS5kYXRhLnBheWxvYWQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5kYXRhID0gdGhpcy5kYXRhU291cmNlLmRhdGEucGF5bG9hZFt0aGlzLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldF07XG5cdFx0XHRcdFx0dGhpcy5kYXRhWydfdGFibGUnXSA9IHRoaXMuZGF0YVNvdXJjZS50YWJsZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kYXRhO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHJld2luZERhdGE6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5kYXRhU291cmNlLmRhdGFSb3dPZmZzZXQgPSAtMTtcblx0XHRcdHRoaXMuZGF0YSA9IG51bGw7XG5cdFx0XHRyZXR1cm4gdGhpcy5kYXRhO1xuXHRcdH0sXG5cblx0XHRjbGVhckRhdGE6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKHRoaXMuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRkZWxldGUgdGhpcy5kYXRhU291cmNlLmRhdGE7XG5cdFx0XHRcdHRoaXMucmV3aW5kRGF0YSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogVGVsbCB0aGUgY29udGFpbmVyIGRhdGFTb3VyY2UgdG8gbG9hZCBpdHMgZGF0YVxuXHRcdCogQHBhcmFtIGNhbGxiYWNrIHN1Y2Nlc3MgRnVuY3Rpb24gdG8gY2FsbCB3aGVuIGRhdGEgbG9hZCBoYXMgY29tcGxldGVkXG5cdFx0Ki9cblx0XHRsb2FkQ29udGFpbmVyRGF0YTogZnVuY3Rpb24oc3VjY2Vzcykge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghdGhpcy5kYXRhU291cmNlKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gZGF0YVNvdXJjZSBzcGVjaWZpZWQgd2hlbiB0cnlpbmcgdG8gbG9hZCBkYXRhIScsIHRoaXMpO1xuXHRcdFx0fSBlbHNlIGlmICghdGhpcy5kYXRhU291cmNlLmZlZWQpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBkYXRhU291cmNlLmZlZWQgc3BlY2lmaWVkIHdoZW4gdHJ5aW5nIHRvIGxvYWQgZGF0YSEnKTtcblx0XHRcdH0gZWxzZSBpZiAoIWJhdHQuZmVlZHNbdGhpcy5kYXRhU291cmNlLmZlZWRdKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignUmVxdWVzdGVkIGRhdGEgZnJvbSBkYXRhU291cmNlIFwiJyArIHRoaXMuZGF0YVNvdXJjZS5mZWVkICsgJ1wiIHRoYXQgaXMgbm90IGxvYWRlZCEnKTtcblx0XHRcdH0gZWxzZSBpZiAoIXRoaXMuZGF0YVNvdXJjZS5kYXRhKSB7IC8vIERhdGEgbm90IGFscmVhZHkgbG9hZGVkXG5cdFx0XHRcdHZhciBkcyA9ICQuZXh0ZW5kKHt9LCBtZS5kYXRhU291cmNlLCB7XG5cdFx0XHRcdFx0ZmllbGRzOiBPYmplY3Qua2V5cyhiYXR0LmZlZWRzW21lLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW4pXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChkcy5maWx0ZXJzKSB7IC8vIFBhcnNlIGFsbCBmaWx0ZXIgYXJndW1lbnRzXG5cdFx0XHRcdFx0dmFyIG5ld0ZpbHRlcnMgPSB7fTtcblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gZHMuZmlsdGVycykge1xuXHRcdFx0XHRcdFx0bmV3RmlsdGVyc1trZXldID0gbWUucGFyc2UoZHMuZmlsdGVyc1trZXldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZHMuZmlsdGVycyA9IG5ld0ZpbHRlcnM7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiYXR0LmZlZWRzW2RzLmZlZWRdLmdldERhdGEoZHMsIGZ1bmN0aW9uKGpzb24pIHtcblx0XHRcdFx0XHRtZS5kYXRhU291cmNlLmRhdGEgPSBqc29uO1xuXHRcdFx0XHRcdG1lLmRhdGFTb3VyY2UuZGF0YVJvd09mZnNldCA9IC0xO1xuXHRcdFx0XHRcdG1lLnJlbmRlcigpO1xuXHRcdFx0XHR9LCBmdW5jdGlvbihlcnJUZXh0LCBlcnJUaHJvd24pIHtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmZpbmQoJy5iYXR0LWxvYWRpbmcnKS5yZW1vdmUoKTtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZCgnPGRpdiBjbGFzcz1cImFsZXJ0XCI+RXJyb3IgbG9hZGluZyBkYXRhOiAnICsgZXJyVGV4dCArICcgLSAnICsgZXJyVGhyb3duICsgJzwvZGl2PicpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7IC8vIFJlbmRlciBjaGlsZHJlbiB3aXRoIGRhdGFcblx0XHRcdFx0c3VjY2VzcygpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIERyYXcgdGhpcyBjb250YWluZXIgb2JqZWN0XG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5lbGVtZW50KSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdiYXR0X2Zvcm0+IFRvbGQgdG8gcmVuZGVyIGJ1dCB3aXRoIG5vIGVsZW1lbnQnLCBtZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFtZS5jaGlsZHJlbk9yZGVyIHx8ICFtZS5jaGlsZHJlbk9yZGVyLmxlbmd0aCkgeyAvLyBJZiBubyBvcmRlciBpcyBzcGVjaWZpZWQganVzdCB1c2UgdGhlIG9yZGVyIG9mIHRoZSBoYXNoICh3aGljaCB3aWxsIGJlIGFscGhhYmV0aWNhbCBpbiBtb3N0IGNhc2VzIC0gYWxzbyBwcm9iYWJseSB3cm9uZylcblx0XHRcdFx0aWYgKCFtZS5jaGlsZHJlbikge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybignYmF0dF9jb250YWluZXI+IFRvbGQgdG8gcmVuZGVyIGJ1dCBJIGhhdmUgbm8gY2hpbGRyZW4hJywgbWUpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRtZS5jaGlsZHJlbk9yZGVyID0gT2JqZWN0LmtleXMobWUuY2hpbGRyZW4pO1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ05vIGNoaWxkcmVuT3JkZXIgc3BlY2lmaWVkLiBJbmhlcml0aW5nIGZyb20gY2hpbGRyZW4gaGFzaCBpbiBoYXNoIG9yZGVyIGluc3RlYWQnLCBtZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtZS5kYXRhU291cmNlKSB7XG5cdFx0XHRcdG1lLmxvYWRDb250YWluZXJEYXRhKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLmNsZWFyKCk7XG5cdFx0XHRcdFx0bWUucmV3aW5kRGF0YSgpO1xuXHRcdFx0XHRcdHZhciBkYXRhO1xuXHRcdFx0XHRcdHdoaWxlIChkYXRhID0gbWUuZ2V0RGF0YSgpKSB7XG5cdFx0XHRcdFx0XHQvLyBDb3B5IG1lIGRhdGEgaW50byBhbGwgY2hpbGRyZW5cblx0XHRcdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuZGF0YUJpbmRpbmcpXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy52YWx1ZSA9IGRhdGFbdGhpcy5kYXRhQmluZGluZ107XG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbaV1dO1xuXHRcdFx0XHRcdFx0XHRjaGlsZC5sb2FkRGF0YSgpO1xuXHRcdFx0XHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblxuXHRcdFx0XHRcdFx0XHRtZS5yZW5kZXJSb3cobWUuZWxlbWVudCwgY2hpbGQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgeyAvLyBObyBkYXRhIHRvIGNhcmUgYWJvdXRcblx0XHRcdFx0bWUuY2xlYXIoKTtcblx0XHRcdFx0Zm9yICh2YXIgYyBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdFx0Y2hpbGQubG9hZERhdGEoKTtcblx0XHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblxuXHRcdFx0XHRcdG1lLnJlbmRlclJvdyhtZS5lbGVtZW50LCBjaGlsZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChtZS5jbGFzc2VzKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYWRkQ2xhc3MobWUuY2xhc3Nlcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Y2xlYXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LmNoaWxkcmVuKCc6bm90KC5iYXR0LXByb3RlY3RlZCknKS5kZXRhY2goKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXJSb3c6IGZ1bmN0aW9uKGVsZW1lbnQsIGNoaWxkKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybigncmVuZGVyUm93IG9mIG5vbmUtZXhpc3RhbnQgZWxlbWVudCBmb3IgY2hpbGQnLCBjaGlsZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c3dpdGNoIChjaGlsZC5jb250YWluZXJEcmF3KSB7IC8vIFdoaWNoIG1ldGhvZCB0byB1c2Ugd2hlbiBkcmF3aW5nIHRoZSBmaWVsZD9cblx0XHRcdFx0Y2FzZSAnZGVidWcnOlxuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kKCc8ZGl2PkRFQlVHIENISUxEPC9kaXY+Jyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3RhYmxlLWNlbGwnOlxuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIgPSAkKCc8dGQ+PC90ZD4nKTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmFwcGVuZChjaGlsZC5lbGVtZW50KTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC53cmFwcGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAncm93Jzpcblx0XHRcdFx0Y2FzZSAnZW50aXJlLXJvdyc6IC8vIERvbnQgdHJ5IHRvIGRvIGFueXRoaW5nXG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmQoY2hpbGQuZWxlbWVudCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3NwYW4nOiAvLyBFeHBhbmQgb3ZlciB0aGUgcm93IGJ1dCB3aXRoIHNwYWNpbmdcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyID0gJCgnPGRpdj48L2Rpdj4nKTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmZpcnN0KCkuYXBwZW5kKGNoaWxkLmVsZW1lbnQpOyAvLyBMb2FkIHRoZSBjaGlsZCBpbnRvIHRoZSAuY29udHJvbHMgZGl2XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmQoY2hpbGQud3JhcHBlcik7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ2J1dHRvbnMnOiAvLyBEcmF3IGFzIGJ1dHRvbiBncm91cFxuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIgPSAkKFxuXHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJmb3JtLWFjdGlvbnNcIiBzdHlsZT1cInBhZGRpbmctbGVmdDogMHB4OyB0ZXh0LWFsaWduOiBjZW50ZXJcIj4nXG5cdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj48L2Rpdj4nXG5cdFx0XHRcdFx0XHQrICc8L2Rpdj4nXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmNoaWxkcmVuKCdkaXYnKS5hcHBlbmQoY2hpbGQuZWxlbWVudCk7IC8vIExvYWQgdGhlIGNoaWxkIGludG8gdGhlIC5jb250cm9scyBkaXZcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC53cmFwcGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnaGlkZS1sYWJlbCc6IC8vIERyYXcgaW4gdXN1YWwgcGxhY2UgYnV0IHdpdGhvdXQgYSBsYWJlbFxuXHRcdFx0XHRcdGNoaWxkLndyYXBwZXIgPSAkKFxuXHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJjb250cm9sLWdyb3VwXCI+J1xuXHRcdFx0XHRcdFx0KyAnPGRpdiBjbGFzcz1cImNvbnRyb2xzXCI+PC9kaXY+J1xuXHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0Y2hpbGQud3JhcHBlci5maW5kKCcuY29udHJvbHMnKS5hcHBlbmQoY2hpbGQuZWxlbWVudCk7IC8vIExvYWQgdGhlIGNoaWxkIGludG8gdGhlIC5jb250cm9scyBkaXZcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZChjaGlsZC53cmFwcGVyKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnbm9ybWFsJzpcblx0XHRcdFx0Y2FzZSAnd2l0aC1sYWJlbCc6IC8vIFdyYXAgY2hpbGQgaW4gdGhlIHVzdWFsIGZsdWZmIC0gbGFiZWwgKyBpbnB1dCBhcmVhXG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0Y2hpbGQud3JhcHBlciA9ICQoXG5cdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cImNvbnRyb2wtZ3JvdXBcIj4nXG5cdFx0XHRcdFx0XHQrICc8bGFiZWwgY2xhc3M9XCJjb250cm9sLWxhYmVsXCI+JyArIChjaGlsZC50aXRsZSB8fCBjaGlsZC5pZCkgKyAnPC9sYWJlbD4nXG5cdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwiY29udHJvbHNcIj48L2Rpdj4nXG5cdFx0XHRcdFx0XHQrICc8L2Rpdj4nXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRjaGlsZC53cmFwcGVyLmZpbmQoJy5jb250cm9scycpLmFwcGVuZChjaGlsZC5lbGVtZW50KTsgLy8gTG9hZCB0aGUgY2hpbGQgaW50byB0aGUgLmNvbnRyb2xzIGRpdlxuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kKGNoaWxkLndyYXBwZXIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHZhbGlkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnZhbGlkYXRlQ2hpbGRyZW4uY2FsbCh0aGlzKTtcblx0XHR9LFxuXG5cdFx0dmFsaWRhdGVDaGlsZHJlbjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgZXJyb3JzID0ge307XG5cdFx0XHRmb3IgKHZhciBjIGluIHRoaXMuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHR2YXIgaWQgPSB0aGlzLmNoaWxkcmVuT3JkZXJbY107XG5cdFx0XHRcdHZhciBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baWRdO1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gY2hpbGQudmFsaWRhdGUoKTtcblx0XHRcdFx0aWYgKHR5cGVvZiByZXN1bHQgPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRlcnJvcnNbaWRdID0gcmVzdWx0O1xuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2FycmF5Jykge1xuXHRcdFx0XHRcdCQuZXh0ZW5kKGVycm9ycywgcmVzdWx0KTtcblx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgcmVzdWx0ID09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdGVycm9yc1tpZF0gPSAnU29tZXRoaW5nIHdlbnQgd3JvbmcnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZXJyb3JzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHR0YXJnZXQ6IG51bGwsXG5cdFx0cmVuZGVyVGFnOiAnPGRpdj48L2Rpdj4nLFxuXHRcdHNwbGl0T246ICcsJyxcblx0XHRzcGxpdEludG86ICd2YWx1ZScsXG5cdFx0c3BsaXRCZXR3ZWVuOiAnJyxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5jaGlsZHJlbk9yZGVyLmxlbmd0aCkgeyAvLyBJZiBubyBvcmRlciBpcyBzcGVjaWZpZWQganVzdCB1c2UgdGhlIG9yZGVyIG9mIHRoZSBoYXNoICh3aGljaCB3aWxsIGJlIGFscGhhYmV0aWNhbCBpbiBtb3N0IGNhc2VzIC0gYWxzbyBwcm9iYWJseSB3cm9uZylcblx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IE9iamVjdC5rZXlzKG1lLmNoaWxkcmVuKTtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdObyBjaGlsZHJlbk9yZGVyIHNwZWNpZmllZC4gSW5oZXJpdGluZyBmcm9tIGNoaWxkcmVuIGhhc2ggaW4gaGFzaCBvcmRlciBpbnN0ZWFkJywgbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIW1lLnRhcmdldCkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfY29udGFpbmVyX3NwbGl0dGVyPiBObyB0YXJnZXQgc3BlY2lmaWVkIHRvIHdvcmsgd2l0aCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIW1lLnNwbGl0T24pIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdiYXR0X2NvbnRhaW5lcl9zcGxpdHRlcj4gTm8gc3BsaXRPbiBzcGVjaWZpZWQgdG8gd29yayB3aXRoJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHRWYWwgPSBtZS5wYXJzZShtZS50YXJnZXQpO1xuXG5cdFx0XHR2YXIgc3BsaXRzID0gdFZhbC5zcGxpdChtZS5zcGxpdE9uKTtcblx0XHRcdGZvciAodmFyIHMgaW4gc3BsaXRzKSB7XG5cdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRtZS5kYXRhW21lLnNwbGl0SW50b10gPSBzcGxpdHNbc107XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0XHR2YXIgY2hpbGQgPSBtZS5jaGlsZHJlblttZS5jaGlsZHJlbk9yZGVyW2NdXTtcblx0XHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblx0XHRcdFx0XHRtZS5yZW5kZXJSb3cobWUuZWxlbWVudCwgY2hpbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtZS5zcGxpdEJldHdlZW4gJiYgcyA8IHNwbGl0cy5sZW5ndGgtMSlcblx0XHRcdFx0XHRtZS5lbGVtZW50LmFwcGVuZChtZS5zcGxpdEJldHdlZW4pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzxkaXYgY2xhc3M9XCJmb3JtLWlubGluZVwiPjwvZGl2PicsXG5cdFx0c2hvd0RhdGU6IHRydWUsXG5cdFx0c2hvd1RpbWU6IHRydWUsXG5cdFx0cmVhZE9ubHk6IGZhbHNlLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmICh0aGlzLnNob3dEYXRlKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCc8ZGl2IGNsYXNzPVwiaW5wdXQtcHJlcGVuZFwiPjxzcGFuIGNsYXNzPVwiYWRkLW9uXCI+PGkgY2xhc3M9XCJpY29uLWNhbGVuZGFyXCI+PC9pPjwvc3Bhbj48aW5wdXQgdHlwZT1cImRhdGVcIiBjbGFzcz1cImlucHV0LW1lZGl1bVwiLz48L2Rpdj4nKTtcblxuXHRcdFx0aWYgKHRoaXMuc2hvd0RhdGUgJiYgdGhpcy5zaG93VGltZSlcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFwcGVuZCgnJm5ic3A7Jyk7XG5cblx0XHRcdGlmICh0aGlzLnNob3dUaW1lKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCc8ZGl2IGNsYXNzPVwiaW5wdXQtcHJlcGVuZFwiPjxzcGFuIGNsYXNzPVwiYWRkLW9uXCI+PGkgY2xhc3M9XCJpY29uLXRpbWVcIj48L2k+PC9zcGFuPjxpbnB1dCB0eXBlPVwidGltZVwiIGNsYXNzPVwiaW5wdXQtc21hbGxcIi8+Jyk7XG5cblx0XHRcdGlmICh0aGlzLnJlYWRPbmx5KVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuZmluZCgnaW5wdXQnKVxuXHRcdFx0XHRcdC5hdHRyKCdyZWFkb25seScsICdyZWFkb25seScpXG5cdFx0XHRcdFx0LmFkZENsYXNzKCdkaXNhYmxlZElucHV0Jyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0Y29udGFpbmVyRHJhdzogJ25vcm1hbCcsXG5cdFx0aW1wbHlDaGlsZDogJ2xpbmsnLFxuXHRcdHRleHQ6ICc8aSBjbGFzcz1cImljb24tYWxpZ24tanVzdGlmeVwiPjwvaT4nLFxuXHRcdGNvbHVtblRpdGxlOiAnJm5ic3A7Jyxcblx0XHRjb2x1bW5XaWR0aDogJzUwcHgnLFxuXHRcdHJlbmRlclRhZzogJzxkaXYgY2xhc3M9XCJkcm9wZG93blwiPjwvZGl2PicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghbWUuY2hpbGRyZW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIgPSBPYmplY3Qua2V5cyhtZS5jaGlsZHJlbik7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gY2hpbGRyZW5PcmRlciBzcGVjaWZpZWQuIEluaGVyaXRpbmcgZnJvbSBjaGlsZHJlbiBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIGRkQnV0dG9uID0gJCgnPGEgY2xhc3M9XCJidG5cIiBkYXRhLXRvZ2dsZT1cImRyb3Bkb3duXCI+JyArIChtZS50ZXh0IHx8IG1lLnRpdGxlKSArICc8L2E+Jylcblx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXG5cdFx0XHR2YXIgZGRJdGVtcyA9ICQoJzx1bCBjbGFzcz1cImRyb3Bkb3duLW1lbnVcIj48L3VsPicpXG5cdFx0XHRcdC5hcHBlbmRUbyhtZS5lbGVtZW50KTtcblxuXHRcdFx0Zm9yICh2YXIgYyBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbY11dO1xuXHRcdFx0XHRpZiAoY2hpbGQudGl0bGUgPT0gJy0nIHx8IGNoaWxkLnRleHQgPT0gJy0nKSB7IC8vIENoaWxkIGlzIGFjdHVhbGx5IGEgc2VwZXJhdG9yXG5cdFx0XHRcdFx0ZGRJdGVtcy5hcHBlbmQoJCgnPGxpIGNsYXNzPVwiZGl2aWRlclwiPjwvbGk+JykpO1xuXHRcdFx0XHR9IGVsc2UgeyAvLyBDaGlsZCBpcyBhIHJlYWwgYm95IVxuXHRcdFx0XHRcdHZhciBjaGlsZFdyYXBwZXIgPSAkKCc8bGk+PC9saT4nKTtcblx0XHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblx0XHRcdFx0XHRjaGlsZFdyYXBwZXIuYXBwZW5kKGNoaWxkLmVsZW1lbnQpO1xuXHRcdFx0XHRcdGRkSXRlbXMuYXBwZW5kKGNoaWxkV3JhcHBlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnNldHVwLmNhbGwodGhpcyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuYXR0cigndHlwZScsICdlbWFpbCcpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zdXBlci5yZW5kZXIuY2FsbCh0aGlzKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHR1cmw6IG51bGwsXG5cdFx0a2V5OiBudWxsLFxuXHRcdG9yZGVyOiBudWxsLFxuXG5cdFx0c2V0OiBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0Y29uc29sZS5sb2coJ0xvYWRlZCBmZWVkIFwiJyArIG1lLmlkICsgJ1wiJyk7XG5cdFx0XHRiYXR0LmZlZWRzW21lLmlkXSA9ICQuZXh0ZW5kKHt9LCBtZSwge2NoaWxkcmVuOiB7fX0pOyAvLyBDbG9uZSB0byBnbG9iYWwgb2JqZWN0IChhbmQgbnVrZSBhbGwgY2hpbGRyZW4gc2luY2Ugd2Ugd2lsbCBiZSBwcm9jZXNzaW5nIHRoZW0gbmV4dCBhbnl3YXkpXG5cdFx0XHQkLmVhY2goanNvbiwgZnVuY3Rpb24oaSwgb2JqKSB7XG5cdFx0XHRcdGJhdHQuZmVlZHNbbWUuaWRdLmFkZENoaWxkKG9iaik7XG5cdFx0XHR9KTtcblx0XHRcdGJhdHQuZmluZChtZS5pZCkucGFyZW50KCkucmVtb3ZlQ2hpbGQobWUuaWQpOyAvLyBSZW1vdmUgc2VsZiBmcm9tIG9iamVjdCBsaXN0c1xuXHRcdH0sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7IC8vIERvIG5vdGhpbmcgLSB0aGlzIGVsZW1lbnQgd2lsbCBiZSByZW1vdmVkIGR1cmluZyBzZXQoKSBhbnl3YXlcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkgeyAvLyBBcyB3aXRoIHNldHVwKCkgd2UgZG9udCBkcmF3IHRoaXMgd2lkZ2V0IGFueXdheVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdGdldERhdGE6IGZ1bmN0aW9uKGRhdGFTb3VyY2UsIHN1Y2Nlc3MsIGZhaWwpIHtcblx0XHRcdGNvbnNvbGUud2FybignYmF0dF9kYl9mZWVkPiBBc2tlZCB0byBnZXQgZGF0YSBidXQgbm8gc3BlY2lmaWMgZHJpdmVyIGlzIHNldHVwJyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0c2V0RGF0YTogZnVuY3Rpb24oZmlsdGVyLCBkYXRhLCBzdWNjZXNzLCBmYWlsKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ2JhdHRfZGJfZmVlZD4gQXNrZWQgdG8gc2V0IGRhdGEgYnV0IG5vIHNwZWNpZmljIGRyaXZlciBpcyBzZXR1cCcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJ2YXIgc2ltcGxlSnNvbkZpbHRlciA9IHJlcXVpcmUoJ3NpbXBsZS1qc29uLWZpbHRlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHVybDogJy9iYXR0L2FwaS9mZWVkJyxcblx0XHRrZXk6ICdpZCcsXG5cdFx0b3JkZXI6ICdpZCcsXG5cdFx0dGFibGU6IG51bGwsIC8vIE92ZXJyaWRlIGlmIHRoZSByZW1vdGUgdGFibGUgZG9lc250IG1hdGNoIHRoaXMgb2JqZWN0cyBpZFxuXHRcdGZ1c3N5OiAnYXV0bycsIC8vIEFwcGx5IGZpbHRlcnMgdG8gaW5jb21taW5nIEpTT04gc3RyZWFtIChpLmUuIGRvbnQgdHJ1c3QgdGhlIHNlcnZlciB0byByZXR1cm4gdGhlIHJpZ2h0IGRhdGEpLiBUcnVlLCBmYWxzZSBvciBcImF1dG9cIiAodHJ1ZSBpZiB1cmwgZW5kcyB3aXRoICcuanNvbicpXG5cblx0XHQvKipcblx0XHQqIEluaXRpYWxpemUgYWxsIGNoaWxkIGZpZWxkc1xuXHRcdCogVGhpcyBmdW5jdGlvbiBhbHNvIHJlbG9jYXRlcyB0aGlzIGZpZWxkIGludG8gYmF0dC5mZWVkcyBvdXRzaWRlIG9mIHRoZSB1c3VhbCB0cmVlIHN0cnVjdHVyZVxuXHRcdCovXG5cdFx0c2V0OiBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHRpZiAodGhpcy50YWJsZSlcblx0XHRcdFx0dGhpcy50YWJsZSA9IHRoaXMuaWQ7XG5cdFx0XHR0aGlzLnN1cGVyLnNldC5jYWxsKHRoaXMsIGpzb24pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUmV0cmlldmUgc29tZSBkYXRhIGJhc2VkIG9uIGEgZ2l2ZW4gZmlsdGVyICsgdGhpcy5maWx0ZXJcblx0XHQqIEBwYXJhbSBhcnJheSBmaWx0ZXIgSGFzaCBvZiBmaWx0ZXJzIHRvIHVzZSAoYmFzaWNseSB0aGUgU1FMIFdIRVJFIGNvbmRpdGlvbilcblx0XHQqIEBwYXJhbSBhcnJheSBmaWVsZHMgVGhlIGZpZWxkcyB0byByZXRyaWV2ZVxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uIHN1Y2Nlc3MgVGhlIHN1Y2Nlc3MgY2FsbGJhY2sgZnVuY3Rpb24uIENhbGxlZCB3aXRoIGZ1bmN0aW9uKGpzb24pXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb24gZmFpbCBUaGUgZmFpbGVkIGNhbGxiYWNrIGZ1bmN0aW9uLiBDYWxsZWQgd2l0aCBmdW5jdGlvbihlcnJUZXh0LCBlcnJUaHJvd24pXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdGdldERhdGE6IGZ1bmN0aW9uKGRhdGFTb3VyY2UsIHN1Y2Nlc3MsIGZhaWwpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHQkLmFqYXgoe1xuXHRcdFx0XHR1cmw6IG1lLnVybCxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0dHlwZTogJ1BPU1QnLFxuXHRcdFx0XHRjYWNoZTogZmFsc2UsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246ICdnZXQnLFxuXHRcdFx0XHRcdGtleTogbWUua2V5LFxuXHRcdFx0XHRcdG9yZGVyOiBkYXRhU291cmNlLm9yZGVyIHx8IG1lLm9yZGVyLFxuXHRcdFx0XHRcdHRhYmxlOiBtZS50YWJsZSB8fCBtZS5pZCxcblx0XHRcdFx0XHRqb2luczogJC5leHRlbmQoe30sIG1lLmpvaW5zLCBkYXRhU291cmNlLmpvaW5zKSxcblx0XHRcdFx0XHRmaWx0ZXJzOiAkLmV4dGVuZCh7fSwgbWUuZmlsdGVycywgZGF0YVNvdXJjZS5maWx0ZXJzKSxcblx0XHRcdFx0XHRmaWVsZHM6ICQuZXh0ZW5kKHt9LCBtZS5maWVsZHMsIGRhdGFTb3VyY2UuZmllbGRzKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbihqc29uKSB7XG5cdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0KG1lLmZ1c3N5ID09PSB0cnVlKVxuXHRcdFx0XHRcdFx0fHwgKG1lLmZ1c3N5ID09PSAnYXV0bycgJiYgL1xcLmpzb24kLy5leGVjKG1lLnVybCkpIC8vIG1lLmZ1c3N5PT1hdXRvIChhbmQgdGhlIFVSTCBlbmRzIHdpdGggLmpzb24pXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHR2YXIgc2pmID0gbmV3IHNpbXBsZUpzb25GaWx0ZXI7XG5cdFx0XHRcdFx0XHRqc29uLnBheWxvYWQgPSBzamZcblx0XHRcdFx0XHRcdFx0LmZpbHRlcihkYXRhU291cmNlLmZpbHRlcnMpXG5cdFx0XHRcdFx0XHRcdC5kYXRhKGpzb24ucGF5bG9hZClcblx0XHRcdFx0XHRcdFx0LmxpbWl0KGRhdGFTb3VyY2UubGltaXQpXG5cdFx0XHRcdFx0XHRcdC53YW50QXJyYXkoKVxuXHRcdFx0XHRcdFx0XHQuZXhlYygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzdWNjZXNzKGpzb24pO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlcnJvcjogZnVuY3Rpb24oanF4aHIsIGVyclRleHQsIGVyclRocm93bikge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybignRXJyb3Igd2hpbGUgcHVsbGluZyBkYXRhJywgZXJyVGV4dCwgZXJyVGhyb3duKTsgLy8gRklYTUU6IGRlYWwgd2l0aCB0aGlzIGdyYWNlZnVsbHlcblx0XHRcdFx0XHRmYWlsKGVyclRleHQsIGVyclRocm93bik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogU2F2ZSBkYXRhIGJhY2sgdG8gdGhlIEJhdHQgZGF0YSBmZWVkXG5cdFx0KiBAcGFyYW0gYXJyYXkgZmlsdGVyIEhhc2ggb2YgZmlsdGVycyB0byB1c2UgKGJhc2ljbHkgdGhlIFNRTCBXSEVSRSBjb25kaXRpb24pXG5cdFx0KiBAcGFyYW0gYXJyYXkgZmllbGRzIFRoZSBmaWVsZHMgdG8gc2V0IGZvciB0aGUgZ2l2ZW4gZml0bGVyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb24gc3VjY2VzcyBUaGUgc3VjY2VzcyBjYWxsYmFjayBmdW5jdGlvbi4gQ2FsbGVkIHdpdGggZnVuY3Rpb24oanNvbilcblx0XHQqIEBwYXJhbSBmdW5jdGlvbiBmYWlsIFRoZSBmYWlsZWQgY2FsbGJhY2sgZnVuY3Rpb24uIENhbGxlZCB3aXRoIGZ1bmN0aW9uKGVyclRleHQsIGVyclRocm93bilcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoaXMgY2hhaW5hYmxlIG9iamVjdFxuXHRcdCovXG5cdFx0c2V0RGF0YTogZnVuY3Rpb24oZGF0YVNvdXJjZSwgZGF0YSwgc3VjY2VzcywgZmFpbCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdCQuYWpheCh7XG5cdFx0XHRcdHVybDogbWUudXJsLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHR0eXBlOiAnUE9TVCcsXG5cdFx0XHRcdGNhY2hlOiBmYWxzZSxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogJ3NldCcsXG5cdFx0XHRcdFx0a2V5OiBtZS5rZXksXG5cdFx0XHRcdFx0dGFibGU6IG1lLnRhYmxlIHx8IG1lLmlkLFxuXHRcdFx0XHRcdGZpbHRlcnM6IGRhdGFTb3VyY2UuZmlsdGVycyxcblx0XHRcdFx0XHRmaWVsZHM6IGRhdGFcblx0XHRcdFx0fSxcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oanNvbikge1xuXHRcdFx0XHRcdHN1Y2Nlc3MoanNvbik7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVycm9yOiBmdW5jdGlvbihqcXhociwgZXJyVGV4dCwgZXJyVGhyb3duKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKCdFcnJvciB3aGlsZSBzZXR0aW5nIGRhdGEnLCBlcnJUZXh0LCBlcnJUaHJvd24pOyAvLyBGSVhNRTogZGVhbCB3aXRoIHRoaXMgZ3JhY2VmdWxseVxuXHRcdFx0XHRcdGZhaWwoZXJyVGV4dCwgZXJyVGhyb3duKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogJzxpIGNsYXNzPVwiaWNvbi1maWxlXCI+PC9pPiBTZWxlY3QgZmlsZS4uLicsXG5cdFx0Y2xhc3NlczogJ2J0bicsXG5cdFx0dGV4dFVwbG9hZGluZzogJzxpIGNsYXNzPVwiaWNvbi1maWxlIGljb24td2hpdGVcIj48L2k+IHt7dmFsdWV9fScsXG5cdFx0Y2xhc3Nlc1VwbG9hZGluZzogJ2J0biBidG4tc3VjY2VzcycsXG5cdFx0cmVuZGVyVGFnOiAnPGE+PC9hPicsXG5cdFx0YXV0b0R1cGxpY2F0ZTogZmFsc2UsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0bWUuZWxlbWVudCA9ICQobWUucmVuZGVyVGFnKTtcblx0XHRcdG1lLmVsZW1lbnRcblx0XHRcdFx0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmICghbWUuZmlsZUlucHV0KSB7IC8vIE5ldmVyIGludGVyYWN0ZWQgd2l0aCB0aGlzIGZpbGUgaW5wdXQgYmVmb3JlXG5cdFx0XHRcdFx0XHQvLyBOT1RFOiBXZSBoYXZlIHRvIHB1dCB0aGUgPGlucHV0IHR5cGU9XCJmaWxlXCIvPiBlbGVtZW50cyBpbiB0aGVpciBvd24gcHJvdGVjdGVkIGFyZWEgc28gdGhleSBkb250IGdldCB3aXBlZCBvbiBhIGJhdHRfY29udGFpbmVyLmNsZWFyKCkuXG5cdFx0XHRcdFx0XHQvLyBOT1RFMjogV2UgaGF2ZSB0byBwdXQgdGhlbSBpbiB0aGVpciBvd24gPGRpdj4sIHJhdGhlciB0aGFuIGp1c3QgYXBwZW5kaW5nIHRoZW0sIGJlY2F1c2UgdGhlIGJyb3dzZXIgd29udCBsZXQgdXMgdHJpZ2dlciB0aGUgJ2NsaWNrJyBldmVudCB1bmxlc3MgdGhleSBhcmUgdmlzaWJsZSAtIGx1Y2tpbHkgdGhlIHBhcmVudCBkaXYgY2FuIGJlIGhpZGRlbiBhbmQgdGhlIGlucHV0IGVsZW1lbnQgY2FuIGJlICdzaG93bicgdG8gZm9vbCB0aGUgYnJvd3NlciBpbnRvIGFsbG93aW5nIHRoaXMuXG5cdFx0XHRcdFx0XHR2YXIgcGFyZW50Rm9ybSA9IG1lLmZpbmRQYXJlbnQoJ2Zvcm0nKTtcblx0XHRcdFx0XHRcdHZhciBwcm90ZWN0ZWRBcmVhID0gcGFyZW50Rm9ybS5lbGVtZW50LmNoaWxkcmVuKCcuYmF0dC1wcm90ZWN0ZWQnKTtcblx0XHRcdFx0XHRcdGlmICghcHJvdGVjdGVkQXJlYS5sZW5ndGgpIC8vIE5vIGV4aXN0aW5nIHByb3RlY3RlZCBhcmVhP1xuXHRcdFx0XHRcdFx0XHRwcm90ZWN0ZWRBcmVhID0gJCgnPGRpdiBjbGFzcz1cImJhdHQtcHJvdGVjdGVkXCIgc3R5bGU9XCJkaXNwbGF5OiBub25lXCI+PC9kaXY+Jylcblx0XHRcdFx0XHRcdFx0XHQuYXBwZW5kVG8ocGFyZW50Rm9ybS5lbGVtZW50KTtcblxuXHRcdFx0XHRcdFx0bWUuZmlsZUlucHV0ID0gJCgnPGlucHV0IHR5cGU9XCJmaWxlXCIgY2xhc3M9XCJiYXR0LXByb3RlY3RlZFwiLz4nKVxuXHRcdFx0XHRcdFx0XHQuYXR0cignbmFtZScsIG1lLmlkKVxuXHRcdFx0XHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdG1lLmNoYW5nZS5jYWxsKG1lKTtcblx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdFx0LmFwcGVuZFRvKHByb3RlY3RlZEFyZWEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtZS5maWxlSW5wdXQudHJpZ2dlcignY2xpY2snKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gbWU7XG5cdFx0fSxcblxuXHRcdGNoYW5nZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0bWUucmVuZGVyKCk7XG5cdFx0XHRpZiAobWUuYXV0b0R1cGxpY2F0ZSkge1xuXHRcdFx0XHR2YXIgYWRkQ2hpbGQgPSB0cnVlO1xuXHRcdFx0XHQvLyBGSVg6IERvbnQgYWRkIGFueSBtb3JlIGNoaWxkcmVuIGlmIHRoZSBsYXN0IGl0ZW0gaW4gdGhlIHNlcXVlbmNlIGRvZXNuJ3QgaGF2ZSBhIHZhbHVlIC0gVGhpcyBpcyB0byBmaXggdGhlIGlzc3VlIHdoZXJlIGNoYW5naW5nIGFuIGV4aXN0aW5nIGZpbGUgdXBsb2FkIGJveCB3b3VsZCBrZWVwIGFkZGluZyBjaGlsZHJlbiB0byB0aGUgZW5kIG9mIHRoZSBjb250YWluZXIgcGFyZW50IHt7e1xuXHRcdFx0XHR2YXIgb3JpZ2luYWxFbGVtZW50ID0gbWU7XG5cdFx0XHRcdHdoaWxlIChvcmlnaW5hbEVsZW1lbnQuY2xvbmVPZikgLy8gVGhpcyBlbGVtZW50IGlzIGFjdHVhbGx5IGEgY2xvbmUgLSBmaW5kIHRoZSBvcmlnaW5hbFxuXHRcdFx0XHRcdG9yaWdpbmFsRWxlbWVudCA9IGJhdHQuZmluZChvcmlnaW5hbEVsZW1lbnQuY2xvbmVPZik7XG5cblx0XHRcdFx0dmFyIG15UGFyZW50ID0gbWUucGFyZW50KCk7XG5cdFx0XHRcdHZhciBjaGlsZHJlbiA9ICQuZXh0ZW5kKFtdLCBteVBhcmVudC5jaGlsZHJlbk9yZGVyKTtcblx0XHRcdFx0Y2hpbGRyZW4ucmV2ZXJzZSgpO1xuXHRcdFx0XHRmb3IgKHZhciBjIGluIGNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0dmFyIGNoaWxkID0gbXlQYXJlbnQuY2hpbGRyZW5bY2hpbGRyZW5bY11dO1xuXHRcdFx0XHRcdGlmIChjaGlsZC5jbG9uZU9mID09IG9yaWdpbmFsRWxlbWVudC5pZCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0ZPVU5EIEZJUlNUIENMT05FJywgY2hpbGQuaWQpO1xuXHRcdFx0XHRcdFx0aWYgKCFjaGlsZC52YWx1ZSlcblx0XHRcdFx0XHRcdFx0YWRkQ2hpbGQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHQvLyB9fX1cblx0XHRcdFx0aWYgKGFkZENoaWxkKVxuXHRcdFx0XHRcdG1lLnBhcmVudCgpXG5cdFx0XHRcdFx0XHQuYWRkQ2hpbGQoJC5leHRlbmQoe30sIG1lLCB7XG5cdFx0XHRcdFx0XHRcdGlkOiBiYXR0LmdldFVuaXF1ZUlkKG1lLmlkKSxcblx0XHRcdFx0XHRcdFx0dmFsdWU6IG51bGwsXG5cdFx0XHRcdFx0XHRcdGNsb25lT2Y6IG9yaWdpbmFsRWxlbWVudC5pZCxcblx0XHRcdFx0XHRcdFx0ZmlsZUlucHV0OiBudWxsXG5cdFx0XHRcdFx0XHR9KSwgJ2FmdGVyJywgbWUuaWQpXG5cdFx0XHRcdFx0XHQucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0XHRtZS5zdXBlci5jaGFuZ2UuY2FsbChtZSk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLmZpbGVJbnB1dCAmJiBtZS5maWxlSW5wdXQudmFsKCkpIHsgLy8gSGFzIGEgZmlsZSB0byB1cGxvYWRcblx0XHRcdFx0bWUudmFsdWUgPSBtZS5maWxlSW5wdXQudmFsKCkucmVwbGFjZSgvXFxcXC9nLCcvJykucmVwbGFjZSggLy4qXFwvLywnJyk7XG5cdFx0XHRcdG1lLmVsZW1lbnRcblx0XHRcdFx0XHQuaHRtbChtZS5wYXJzZShtZS50ZXh0VXBsb2FkaW5nKSlcblx0XHRcdFx0XHQucmVtb3ZlQ2xhc3MobWUuY2xhc3Nlcylcblx0XHRcdFx0XHQuYWRkQ2xhc3MobWUuY2xhc3Nlc1VwbG9hZGluZyk7XG5cdFx0XHR9IGVsc2UgeyAvLyBOb3RoaW5nIHRvIHVwbG9hZCBidXQgc3RpbGwgaGFzIHN5bGluZ1xuXHRcdFx0XHRtZS5lbGVtZW50XG5cdFx0XHRcdFx0Lmh0bWwobWUucGFyc2UobWUudGV4dCkpXG5cdFx0XHRcdFx0LnJlbW92ZUNsYXNzKG1lLmNsYXNzZXNVcGxvYWRpbmcpXG5cdFx0XHRcdFx0LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdG1ldGhvZDogJ1BPU1QnLCAvLyBQT1NUIC0gUmVndWxhciBIVE1MIHN1Ym1pdCwgQkFUVCAtIGludGVybmFsIEFKQVggY2FsbHMgdG8gYSBCYXR0IHNlcnZlclxuXHRcdGFjdGlvbjogJz8nLCAvLyBJZiB0eXBlPWh0bWwgdGhpcyBpcyB0aGUgbG9jYXRpb24gd2hlcmUgdGhlIGZvcm0gd2lsbCBiZSBzdWJtaXR0ZWQuXG5cdFx0cmVuZGVyVGFnOiAnPGZvcm0gYWN0aW9uPVwie3t7YWN0aW9ufX19XCIgbWV0aG9kPVwie3ttZXRob2R9fVwiIGNsYXNzPVwiZm9ybS1ob3Jpem9udGFsXCIgZW5jdHlwZT1cIm11bHRpcGFydC9mb3JtLWRhdGFcIj48L2Zvcm0+JyxcblxuXHRcdHN1Ym1pdDogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLnZhbGlkYXRlKCkpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1NVQk1JVD4gT0snKTtcblxuXHRcdFx0XHRzd2l0Y2ggKG1lLm1ldGhvZC50b1VwcGVyQ2FzZSgpKSB7XG5cdFx0XHRcdFx0Y2FzZSAnUE9TVCc6XG5cdFx0XHRcdFx0XHRtZS5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdGlmICghdGhpcy5pZEZha2UpXG5cdFx0XHRcdFx0XHRcdFx0bWUuZWxlbWVudC5hcHBlbmQoJzxpbnB1dCB0eXBlPVwiaGlkZGVuXCIgbmFtZT1cIicgKyB0aGlzLmlkICsgJ1wiIHZhbHVlPVwiJyArICh0aGlzLnZhbHVlICE9PSBudWxsID8gdGhpcy52YWx1ZSA6ICcnKSArICdcIi8+Jyk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ0JBVFQnOlxuXHRcdFx0XHRcdFx0Ly8gR2V0IGFsbCBjaGlsZHJlbiB3aGljaCByZXF1ZXN0IGZyb20gYSBkYXRhU291cmNlIHt7e1xuXHRcdFx0XHRcdFx0dmFyIGRhdGFTb3VyY2VzID0gW107XG5cdFx0XHRcdFx0XHRtZS5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLmRhdGFTb3VyY2UpXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YVNvdXJjZXMucHVzaCh0aGlzKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0Ly8gfX19XG5cdFx0XHRcdFx0XHQvLyBGSVhNRTogQXZvaWQgcGVlcnMgYmVpbmcgaW5zaWRlIHBlZXJzXG5cdFx0XHRcdFx0XHQvLyBGb3IgZWFjaCBkYXRhU291cmNlLi4uIHt7e1xuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBkYXRhU291cmNlcykge1xuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHt9O1xuXHRcdFx0XHRcdFx0XHR2YXIgZHMgPSAkLmV4dGVuZCh7fSwgZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdC8vIEV2YWx1YXRlIGFsbCBmaWx0ZXJzIHt7e1xuXHRcdFx0XHRcdFx0XHRpZiAoZHMuZmlsdGVycykgeyAvLyBQYXJzZSBhbGwgZmlsdGVyIGFyZ3VtZW50c1xuXHRcdFx0XHRcdFx0XHRcdHZhciBuZXdGaWx0ZXJzID0ge307XG5cdFx0XHRcdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIGRzLmZpbHRlcnMpIHtcblx0XHRcdFx0XHRcdFx0XHRcdG5ld0ZpbHRlcnNba2V5XSA9IG1lLnBhcnNlKGRzLmZpbHRlcnNba2V5XSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGRzLmZpbHRlcnMgPSBuZXdGaWx0ZXJzO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdC8vIH19fVxuXHRcdFx0XHRcdFx0XHRkYXRhU291cmNlc1tpXS5lYWNoQ2hpbGQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0XHRcdFx0KHRoaXMuZGF0YUJpbmRpbmcpIC8vIEhhcyBhIGRhdGEgYmluZGluZ1xuXHRcdFx0XHRcdFx0XHRcdFx0JiYgKGJhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXSkgLy8gVGhlIGZlZWQgdGhpcyBpdGVtIGlzIHBvaW50aW5nIGF0IGlzIHZhbGlkXG5cdFx0XHRcdFx0XHRcdFx0XHQmJiAoYmF0dC5mZWVkc1tkYXRhU291cmNlc1tpXS5kYXRhU291cmNlLmZlZWRdLmNoaWxkcmVuW3RoaXMuZGF0YUJpbmRpbmddKSAvLyBUaGUgZmVlZCByZWNvZ25pemVzIHRoaXMgY2hpbGRcblx0XHRcdFx0XHRcdFx0XHRcdCYmIChiYXR0LmZlZWRzW2RhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW5bdGhpcy5kYXRhQmluZGluZ10uYWxsb3dTZXQpIC8vIFRoZSBmZWVkIHNheXMgdGhpcyBjaGlsZCBpdGVtIGNhbiBiZSBzZXRcblx0XHRcdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChiYXR0LmZlZWRzW2RhdGFTb3VyY2VzW2ldLmRhdGFTb3VyY2UuZmVlZF0uY2hpbGRyZW5bdGhpcy5kYXRhQmluZGluZ10uZGF0YUlkKSB7IC8vIFVzZSBhbHRlcm5hdGUgaW50ZXJuYWwgbmFtZSBmb3IgdGhlIGRhdGFJZFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRhW2JhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXS5jaGlsZHJlblt0aGlzLmRhdGFCaW5kaW5nXS5kYXRhSWRdID0gdGhpcy52YWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7IC8vIE5vIGFsdGVybmF0ZSBzcGVjaWZpZWQgLSBqdXN0IHBhc3MgdGhlIElEXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRhdGFbdGhpcy5kYXRhQmluZGluZ10gPSB0aGlzLnZhbHVlO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGJhdHQuZmVlZHNbZGF0YVNvdXJjZXNbaV0uZGF0YVNvdXJjZS5mZWVkXS5zZXREYXRhKGRzLCBkYXRhLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnRklYTUU6IFNBVkVEIScpO1xuXHRcdFx0XHRcdFx0XHR9LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnRklYTUU6IFNBVkUgRkFJTEVEIScpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vIH19fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnQkFUVC1MRUdBQ1knOlxuXHRcdFx0XHRcdFx0dmFyIGRhdGEgPSB7fTtcblx0XHRcdFx0XHRcdG1lLmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuZGF0YUJpbmRpbmcpXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YVt0aGlzLmRhdGFCaW5kaW5nXSA9IHRoaXMudmFsdWU7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignQmF0dCBzdWJtaXNzaW9uIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnU0FWRT4nLCBkYXRhKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRhbGVydCgnVW5zdXBwb3J0ZWQgZm9ybSB0eXBlOiAnICsgbWUubWV0aG9kKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1NVQk1JVD4gRkFJTCcpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oZm9ybVBhcmVudCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmVsZW1lbnQgPSAkKG1lLnBhcnNlKG1lLnJlbmRlclRhZykpO1xuXHRcdFx0bWUuZWxlbWVudC5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRtZS5zdWJtaXQuY2FsbChtZSk7XG5cdFx0XHRcdGlmIChtZS5tZXRob2QgPT0gJ0JBVFQnKVxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH0pO1xuXHRcdFx0aWYgKGZvcm1QYXJlbnQpXG5cdFx0XHRcdG1lLmVsZW1lbnQuYXBwZW5kVG8oZm9ybVBhcmVudCk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRpZiAoIW1lLmVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ2JhdHRfZm9ybT4gVG9sZCB0byByZW5kZXIgYnV0IHdpdGggbm8gcGFyZW50IGVsZW1lbnQnLCBtZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bWUuc3VwZXIucmVuZGVyLmNhbGwobWUpO1xuXHRcdFx0bWUuZWFjaENoaWxkKGZ1bmN0aW9uKCkgeyAvLyBDYWxjdWxhdGUgaW5pdGlhbCBzdGF0ZSBvZiBhbGwgc2hvd0lmIGV2ZW50c1xuXHRcdFx0XHR0aGlzLmNoYW5nZU90aGVyKGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdzcGFuJyxcblx0XHR0aXRsZTogJ0EgaGVhZGluZycsXG5cdFx0cmVuZGVyVGFnOiAnPGxlZ2VuZD48L2xlZ2VuZD4nLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnJlbmRlclRhZyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5odG1sKHRoaXMudGl0bGUpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdzcGFuJyxcblx0XHR0ZXh0OiAnPGRpdiBjbGFzcz1cImFsZXJ0IGFsZXJ0LWluZm9cIj5IZWxsbyBXb3JsZDwvZGl2PicsXG5cdFx0Y2xhc3NlczogbnVsbCxcblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGh0bWwgPSB0aGlzLnRleHQgfHwgdGhpcy50aXRsZTtcblx0XHRcdGlmIChodG1sLnN1YnN0cigwLCAxKSAhPSAnPCcpIC8vIERvZXNuJ3QgYWxyZWFkeSBoYXZlIGEgdGFnIHN0cnVjdHVyZVxuXHRcdFx0XHRodG1sID0gJzxkaXY+JyArIGh0bWwgKyAnPC9kaXY+JztcblxuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCh0aGlzLnBhcnNlKGh0bWwpKTtcblxuXHRcdFx0aWYgKHRoaXMuY2xhc3Nlcylcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFkZENsYXNzKHRoaXMuY2xhc3Nlcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0cGxhY2Vob2xkZXI6IG51bGwsXG5cdFx0Y2xhc3NlczogbnVsbCxcblx0XHRyZXF1aXJlZDogZmFsc2UsXG5cdFx0bGVuZ3RoTWF4OiBudWxsLFxuXHRcdGxlbmd0aE1pbjogbnVsbCxcblx0XHRyZWFkT25seTogbnVsbCxcblx0XHRlcnJvclJlcXVpcmVkOiAnU3RyaW5nIHJlcXVpcmVkJyxcblx0XHRlcnJvckxlbmd0aE1heDogJ1N0cmluZyB0b28gbG9uZycsXG5cdFx0ZXJyb3JMZW5ndGhNaW46ICdTdHJpbmcgdG9vIHNob3J0JyxcblxuXHRcdGNoYW5nZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnZhbHVlID0gdGhpcy5lbGVtZW50LnZhbCgpO1xuXHRcdFx0dGhpcy5zdXBlci5jaGFuZ2UuY2FsbCh0aGlzKTtcblx0XHR9LFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lXG5cdFx0XHRcdC5lbGVtZW50ID0gJCgnPGlucHV0Lz4nKVxuXHRcdFx0XHQub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG1lLmNoYW5nZS5jYWxsKG1lKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gbWU7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLnZhbHVlKVxuXHRcdFx0XHRtZS5lbGVtZW50LmF0dHIoJ3ZhbHVlJywgbWUudmFsdWUpO1xuXHRcdFx0aWYgKG1lLnBsYWNlaG9sZGVyKVxuXHRcdFx0XHRtZS5lbGVtZW50LmF0dHIoJ3BsYWNlaG9sZGVyJywgbWUucGxhY2Vob2xkZXIpO1xuXHRcdFx0aWYgKG1lLnJlYWRPbmx5KVxuXHRcdFx0XHRtZS5lbGVtZW50XG5cdFx0XHRcdFx0LmF0dHIoJ3JlYWRvbmx5JywgJ3JlYWRvbmx5Jylcblx0XHRcdFx0XHQuYWRkQ2xhc3MoJ2Rpc2FibGVkSW5wdXQnKTtcblx0XHRcdGlmIChtZS5kYXRhQmluZGluZylcblx0XHRcdFx0bWUuZWxlbWVudC5hdHRyKCdiYXR0LWRhdGEtYmluZGluZycsIG1lLmRhdGFCaW5kaW5nKTtcblx0XHRcdGlmIChtZS5jbGFzc2VzKVxuXHRcdFx0XHRtZS5lbGVtZW50LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXHRcdFx0cmV0dXJuIG1lO1xuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAodGhpcy5yZXF1aXJlZCAmJiAhdGhpcy52YWx1ZSlcblx0XHRcdFx0cmV0dXJuIHRoaXMuZXJyb3JSZXF1aXJlZDtcblx0XHRcdGlmICh0aGlzLmxlbmd0aE1heCAmJiB0aGlzLnZhbHVlLmxlbmd0aCA+IHRoaXMubGVuZ3RoTWF4KVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvckxlbmd0aE1heDtcblx0XHRcdGlmICh0aGlzLmxlbmd0aE1pbiAmJiB0aGlzLnZhbHVlLmxlbmd0aCA+IHRoaXMubGVuZ3RoTWluKVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvckxlbmd0aE1pbjtcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogbnVsbCxcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblx0XHRjbGFzc2VzOiBudWxsLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCgnPGxhYmVsIGNsYXNzPVwiY2hlY2tib3hcIj48L2xhYmVsPicpOyAvLyBPZGQgdGhhdCBCb290c3RyYXAgaGFzIG5vIG90aGVyIHdheSBvZiBoYXZpbmcgbm9uLXdlaXJkIGxvb2tpbmcgZm9ybSB0ZXh0XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHRtZS5lbGVtZW50Lmh0bWwobWUucGFyc2UobWUudGV4dCB8fCBtZS50aXRsZSB8fCAnQSBsYWJlbCcpKTtcblx0XHRcdFxuXHRcdFx0aWYgKG1lLmNsYXNzZXMpXG5cdFx0XHRcdG1lLmVsZW1lbnQuYWRkQ2xhc3MobWUuY2xhc3Nlcyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0dGV4dDogbnVsbCxcblx0XHRjb250YWluZXJEcmF3OiAnbm9ybWFsJyxcblx0XHRhY3Rpb246ICdub3RoaW5nJyxcblx0XHRjbGFzc2VzOiBudWxsLFxuXHRcdGljb246IG51bGwsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKCc8YT48L2E+Jyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHR2YXIgYWN0aW9uID0gbWUucGFyc2UobWUuYWN0aW9uKTtcblx0XHRcdG1lLmVsZW1lbnRcblx0XHRcdFx0Lmh0bWwobWUucGFyc2UobWUudGV4dCB8fCBtZS50aXRsZSB8fCAnQSBsaW5rJykpXG5cdFx0XHRcdC5hdHRyKCdocmVmJywgYWN0aW9uKTtcblxuXHRcdFx0aWYgKG1lLmljb24pXG5cdFx0XHRcdG1lLmVsZW1lbnQucHJlcGVuZCgnPGkgY2xhc3M9XCInICsgbWUuaWNvbiArICdcIj48L2k+Jyk7XG5cdFx0XHRcblx0XHRcdGlmIChtZS5jbGFzc2VzKVxuXHRcdFx0XHRtZS5lbGVtZW50LmFkZENsYXNzKG1lLmNsYXNzZXMpO1xuXG5cdFx0XHRzd2l0Y2ggKGFjdGlvbikge1xuXHRcdFx0XHRjYXNlICdub3RoaW5nJzpcblx0XHRcdFx0XHRtZS5lbGVtZW50LmNsaWNrKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0YWxlcnQoJ05vIGFjdGlvbiBpcyBhc3NpZ25lZCB0byB0aGlzIGJ1dHRvbicpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdzYXZlJzpcblx0XHRcdFx0Y2FzZSAnc3VibWl0Jzpcblx0XHRcdFx0XHRtZS5lbGVtZW50LmNsaWNrKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0bWUuZmluZFBhcmVudCgnZm9ybScpLmVsZW1lbnQudHJpZ2dlcignc3VibWl0Jyk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6IC8vIEFzc2lnbiBhcyBocmVmIGxpbmtcblx0XHRcdFx0XHRtZS5lbGVtZW50LmF0dHIoJ2hyZWYnLCBhY3Rpb24pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdG1pbjogbnVsbCxcblx0XHRtYXg6IG51bGwsXG5cdFx0ZGVjaW1hbHM6IDAsXG5cdFx0ZXJyb3JNaW46ICdOdW1iZXIgdG9vIHNtYWxsJyxcblx0XHRlcnJvck1heDogJ051bWJlciB0b28gbGFyZ2UnLFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc3VwZXIucmVuZGVyLmNhbGwodGhpcyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuYXR0cigndHlwZScsICdudW1iZXInKTtcblx0XHRcdGlmICh0aGlzLmRlY2ltYWxzKVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXR0cignc3RlcCcsICdhbnknKTtcblx0XHRcdGlmICh0aGlzLm1pbilcblx0XHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ21pbicsIHRoaXMubWluKTtcblx0XHRcdGlmICh0aGlzLm1heClcblx0XHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ21heCcsIHRoaXMubWF4KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnN1cGVyLnZhbGlkYXRlLmNhbGwodGhpcyk7XG5cdFx0XHRpZiAodGhpcy5taW4gJiYgdGhpcy52YWx1ZSA8IHRoaXMubWluKVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5lcnJvck1pbjtcblx0XHRcdGlmICh0aGlzLm1heCAmJiB0aGlzLnZhbHVlID4gdGhpcy5tYXgpXG5cdFx0XHRcdHJldHVybiB0aGlzLmVycm9yTWF4O1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRpZDogbnVsbCxcblx0XHRkYXRhSWQ6IG51bGwsIC8vIElmIHRoZSBpbnRlcm5hbCBzdG9yYWdlIHJlZmVycyB0byB0aGUgZmllbGQgYnkgYW5vdGhlciBuYW1lIC0gc3BlY2lmeSBpdCBoZXJlXG5cdFx0dmFsdWU6IG51bGwsXG5cdFx0ZGVmYXVsdDogbnVsbCxcblx0XHRlbGVtZW50OiBudWxsLFxuXHRcdGNvbnRhaW5lckRyYXc6ICd3aXRoLWxhYmVsJyxcblx0XHR1c2VzOiBudWxsLFxuXHRcdHNob3dJZjogbnVsbCxcblxuXHRcdC8vIER1bW15IGZ1bmN0aW9uc1xuXHRcdHZhbGlkYXRlOiBmdW5jdGlvbigpIHsgcmV0dXJuOyB9LFxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9LFxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0sXG5cdFx0Y2xlYXJEYXRhOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0sXG5cblx0XHRsb2FkRGF0YTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAodGhpcy52YWx1ZSkgLy8gV2UgYWxyZWFkeSBoYXZlIGEgdmFsdWVcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cblx0XHRcdGlmICh0aGlzLmRhdGEgJiYgdGhpcy5kYXRhW3RoaXMuaWRdKSB7IC8vIElzIHRoZXJlIGFueXRoaW5nIGluIHRoZSBkYXRhIHN0cmVhbT9cblx0XHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZGF0YVt0aGlzLmlkXTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5kZWZhdWx0KSB7IC8vIElzIHRoZXJlIGEgZGVmYXVsdCB2YWx1ZT9cblx0XHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZGVmYXVsdDtcblx0XHRcdH0gZWxzZSB7IC8vIEZvdW5kIG5vdGhpbmcgLSBzZXQgdG8gbnVsbFxuXHRcdFx0XHR0aGlzLnZhbHVlID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIExvY2F0ZSB0aGUgcGFyZW50IG9mIHRoZSBjdXJyZW50IEJhdHQgb2JqZWN0IGFuZCByZXR1cm4gZWl0aGVyIHRoZSBzdGFjayBvZiBhbGwgcGFyZW50cyAoZ3JhbmQtcGFyZW50cyBldGMuKSBvciBhIHNwZWNpZmljIHR5cGVcblx0XHQqIEJlY2F1c2Ugb2YgaGFzaC1vZi1oYXNoZXMgc3RydWN0dXJlIEJhdHQgdXNlcyB0byBzdGFzaCBpdHMgb2JqZWN0cyB0aGlzIGZ1bmN0aW9uIGRvZXMgYSB0b3AtZG93biBzZWFyY2ggb2YgYWxsIGZvcm1zIGFuZCBhbGwgY2hpbGRyZW4gdW50aWwgaXQgaGl0cyB0aGUgY3VycmVudCBpZCwgaXQgdGhlbiBidWJibGVzIHVwIGFzIGEgcmV0dXJuIHZhbHVlIHRvIGZpbmQgdGhlIHN0YWNrIG9mIGFsbCBwYXJlbnRzXG5cdFx0KiBAcGFyYW0gc3RyaW5nIHR5cGUgT3B0aW9uYWwgdHlwZSB0byBsaW1pdCBvdXJzZWx2ZXMgdG8uIElmIHNwZWNpZmllZCB0aGUgcmV0dXJuIHdpbGwgZWl0aGVyIGJlIHRoZSBmaXJzdCB3aWRnZXQgbWF0Y2hpbmcgdGhlIHR5cGUgT1IgbnVsbFxuXHRcdCogQHJldHVybiBvYmplY3R8bnVsbHxhcnJheSBJZiB0eXBlIGlzIHNwZWNpZmllZCB0aGUgZmlyc3Qgb2JqZWN0IG1hdGNoaW5nIHRoZSB0eXBlIE9SIG51bGwsIGlmIHVuc3BlY2lmaWVkIGFuIGFycmF5IG9mIGFsbCBwYXJlbnRzXG5cdFx0Ki9cblx0XHRmaW5kUGFyZW50OiBmdW5jdGlvbih0eXBlKSB7XG5cdFx0XHR2YXIgZmluZFBhcmVudFdvcmtlciA9IGZ1bmN0aW9uKGlkLCBjb250ZXh0LCBzdGFjaykge1xuXHRcdFx0XHRpZiAoIWNvbnRleHQuY2hpbGRyZW4pXG5cdFx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRcdGlmIChjb250ZXh0LmNoaWxkcmVuW2lkXSkge1xuXHRcdFx0XHRcdHN0YWNrLnB1c2goY29udGV4dC5jaGlsZHJlbltpZF0pO1xuXHRcdFx0XHRcdHN0YWNrLnB1c2goY29udGV4dCk7XG5cdFx0XHRcdFx0cmV0dXJuIHN0YWNrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yICh2YXIgYyBpbiBjb250ZXh0LmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0dmFyIGZvdW5kID0gZmluZFBhcmVudFdvcmtlcihpZCwgY29udGV4dC5jaGlsZHJlbltjXSwgc3RhY2spO1xuXHRcdFx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRcdFx0c3RhY2sucHVzaChjb250ZXh0KTtcblx0XHRcdFx0XHRcdHJldHVybiBzdGFjaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXG5cdFx0XHRmb3IgKHZhciBiIGluIGJhdHQuZm9ybXMpIHtcblx0XHRcdFx0dmFyIHN0YWNrID0gZmluZFBhcmVudFdvcmtlcih0aGlzLmlkLCBiYXR0LmZvcm1zW2JdLCBbXSk7XG5cdFx0XHRcdGlmIChzdGFjaykge1xuXHRcdFx0XHRcdGlmICh0eXBlKSB7IC8vIExvb2tpbmcgZm9yIGEgc3BlY2lmaWMgdHlwZVxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgcCBpbiBzdGFjaylcblx0XHRcdFx0XHRcdFx0aWYgKHN0YWNrW3BdLnR5cGUgPT0gdHlwZSlcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gc3RhY2tbcF07XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBzdGFjay5zbGljZSgxKTtcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0KiBDb252ZW5pZW5jZSB3cmFwcGVyIGZvciBjYWxsaW5nIHBhcmVudHMoKSBhbmQgdXNpbmcgb25seSB0aGUgZmlyc3QgaXRlbSBvZiB0aGUgYXJyYXlcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoZSBwYXJlbnQgKGEgY29udGFpbmVyKSBvZiB0aGUgY3VycmVudCBvYmplY3Rcblx0XHQqL1xuXHRcdHBhcmVudDogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgcGFyZW50cyA9IHRoaXMuZmluZFBhcmVudC5jYWxsKHRoaXMpO1xuXHRcdFx0cmV0dXJuIHBhcmVudHNbMF07XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUnVuIGEgY2FsbGJhY2sgb3ZlciBlYWNoIHBhcmVudCBvZiB0aGUgY3VycmVudCBvYmplY3Rcblx0XHQqIFRoaXMgZnVuY3Rpb24gaXMgcmVjdXJzaXZlLiBJZiB5b3UgcmVxdWlyZSBqdXN0IHRoZSBpbW1lZGlhdGUgcGFyZW50cyB1c2Ugb2JqZWN0LnBhcmVudCgpXG5cdFx0KiBUaGlzIGlzIHRoZSBtaXJyb3IgZnVuY3Rpb24gb2YgZWFjaENoaWxkKClcblx0XHQqIEBwYXJhbSBjYWxsYmFjayBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuLiBDYWxsZWQgaW4gdGhlIGZvcm1hdCBmdW5jdGlvbigpIHt9IHNldHRpbmcgJ3RoaXMnIHRvIHRoZSBjdXJyZW50IGNvbnRleHRcblx0XHQqIEBwYXJhbSBoYXNoIG9wdGlvbnMgQSBoYXNoIG9mIG9wdGlvbnMgdG8gdXNlIHdoZW4gZmlsdGVyaW5nXG5cdFx0KiBAcGFyYW0gb2JqZWN0IG9iamVjdCBDb250ZXh0IG9iamVjdCAoaW50ZXJuYWwgdXNlIG9ubHkpXG5cdFx0KiBAcmV0dXJuIG9iamVjdCBUaGlzIGNoYWluYWJsZSBvYmplY3Rcblx0XHQqL1xuXHRcdGVhY2hQYXJlbnQ6IGZ1bmN0aW9uKGNhbGxiYWNrLCBvcHRpb25zLCBjb250ZXh0KSB7XG5cdFx0XHRpZiAoIWNvbnRleHQpXG5cdFx0XHRcdGNvbnRleHQgPSB0aGlzO1xuXG5cdFx0XHR2YXIgc2V0dGluZ3MgPSAkLmV4dGVuZCh7fSwge1xuXHRcdFx0XHRhbmRTZWxmOiBmYWxzZVxuXHRcdFx0fSwgb3B0aW9ucyk7XG5cblx0XHRcdGlmIChzZXR0aW5ncy5hbmRTZWxmKVxuXHRcdFx0XHRjYWxsYmFjay5jYWxsKGNvbnRleHQpO1xuXG5cdFx0XHR2YXIgbm9kZXMgPSB0aGlzLmZpbmRQYXJlbnQoKTtcblx0XHRcdGZvciAodmFyIHBpZCBpbiBub2Rlcykge1xuXHRcdFx0XHR2YXIgbm9kZSA9IG5vZGVzW3BpZF07XG5cdFx0XHRcdGNhbGxiYWNrLmNhbGwobm9kZSk7XG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCogUGFyc2UgYSBNdXN0YWNoZSB0ZW1wbGF0ZSBhZ2FpbnN0IHRoZSBjdXJyZW50IG9iamVjdFxuXHRcdCogVGhpcyBpcyByZWFsbHkganVzdCBhIGhlbHBlciBmb3IgdGhlIGNvcmUgYmF0dC5wYXJzZSgpIGZ1bmN0aW9uXG5cdFx0KiBAcGFyYW0gc3RyaW5nIHN0cmluZyBUaGUgc3RyaW5nIHRvIHBhcnNlIGFuZCByZXR1cm5cblx0XHQqIEBwYXJhbSBvYmplY3QgZGF0YSBBZGRpdGlvbmFsIGRhdGEgdG8gcGFzcyB0byB0aGUgcGFyc2UgZnVuY3Rpb25cblx0XHQqIEByZXR1cm4gc3RyaW5nIFRoZSBwYXJzZWQgc3RyaW5nXG5cdFx0Ki9cblx0XHRwYXJzZTogZnVuY3Rpb24oc3RyaW5nLCBkYXRhKSB7XG5cdFx0XHRyZXR1cm4gYmF0dC5wYXJzZShzdHJpbmcsIGRhdGEgPyAkLmV4dGVuZCh7fSwgdGhpcywgZGF0YSkgOiB0aGlzKTtcblx0XHR9LFxuXG5cdFx0Y2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0XHQvLyBUcmlnZ2VyIHRoZSBjaGFuZ2VPdGhlciBldmVudCBvbiBhbGwgb3RoZXIgaXRlbXNcblx0XHRcdG1lXG5cdFx0XHRcdC5maW5kUGFyZW50KCdmb3JtJylcblx0XHRcdFx0LmVhY2hDaGlsZChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5pZCAhPSBtZS5pZClcblx0XHRcdFx0XHRcdHRoaXMuY2hhbmdlT3RoZXIuY2FsbCh0aGlzLCB0cnVlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Y2hhbmdlT3RoZXI6IGZ1bmN0aW9uKHVzZXJDaGFuZ2VkKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKG1lLnNob3dJZikge1xuXHRcdFx0XHR2YXIgc2hvdztcblx0XHRcdFx0LyoqXG5cdFx0XHRcdCogV2UgZm91bmQgYSBzaG93SWYgaGFzaCBvYmplY3QuXG5cdFx0XHRcdCogVGhlc2UgdXN1YWxseSBsb29rIGxpa2U6XG5cdFx0XHRcdCpcblx0XHRcdFx0Klx0e2ZvbzogJ2JhcicsIGJhejogJ3F1eid9IC8vIE9ubHkgc2hvdyBpZiBmb289YmFyIEFORCBiYXo9cXV6XG5cdFx0XHRcdCpcdHsnZm9vIGlzJzogJ2VtcHR5J30gLy8gT25seSBzaG93IG9iamVjdCAnZm9vJyBoYXMgbm8gY2hpbGRyZW4gKGFsc28gYXBwbGljYWJsZTogJ2VtcHR5JywgJ25vZGF0YScsICdubyBkYXRhJylcblx0XHRcdFx0Klx0eydmb28gaXMnOiAnZW1wdHknfSAvLyBPbmx5IHNob3cgb2JqZWN0ICdmb28nIGhhcyBTT01FIGNoaWxkcmVuIChhbHNvIGFwcGxpY2FibGU6ICdjaGlsZHJlbicsICdkYXRhJywgJ25vdCBlbXB0eScsICdub3RlbXB0eScpXG5cdFx0XHRcdCpcblx0XHRcdFx0KiBOT1RFOiAnaXMnIGFuZCAnaGFzJyBhcmUgaW50ZXJjaGFuZ2FibGUgaW4gdGhlIGFib3ZlIHN5bnRheC4gU28geydmb28gaGFzJzogJ25vIGNoaWxkcmVuJ30gaXMgdGhlIHNhbWUgYXMgeydmb28gaXMnOiAnZW1wdHknfVxuXHRcdFx0XHQqXG5cdFx0XHRcdCovXG5cdFx0XHRcdGlmICh0eXBlb2YgbWUuc2hvd0lmID09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0dmFyIGZvcm0gPSBtZS5maW5kUGFyZW50KCdmb3JtJyk7XG5cdFx0XHRcdFx0c2hvdyA9IDE7XG5cdFx0XHRcdFx0Zm9yICh2YXIgZmllbGQgaW4gbWUuc2hvd0lmKSB7IC8vIEN5Y2xlIHRob3VnaCBhbGwgZmllbGRzIHVudGlsIHdlIGZpbmQgc29tZXRoaW5nIHRoYXQgRE9FU05UIG1hdGNoXG5cdFx0XHRcdFx0XHR2YXIgbWF0Y2hlcztcblx0XHRcdFx0XHRcdGlmIChtYXRjaGVzID0gL14oLiopICg/OmlzfGhhcykkLy5leGVjKGZpZWxkKSkgeyAvLyBVc2VzICdpcycgc3ludGF4XG5cdFx0XHRcdFx0XHRcdHZhciBvYmpcblx0XHRcdFx0XHRcdFx0c3dpdGNoIChtZS5zaG93SWZbZmllbGRdKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y2FzZSAnY2hpbGRyZW4nOlxuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2RhdGEnOlxuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ25vdGVtcHR5Jzpcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdub3QgZW1wdHknOlxuXHRcdFx0XHRcdFx0XHRcdFx0b2JqID0gZm9ybS5maW5kKG1hdGNoZXNbMV0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKCFvYmouY2hpbGRyZW4gfHwgIU9iamVjdC5rZXlzKG9iai5jaGlsZHJlbikubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHNob3cgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ25vIGRhdGEnOlxuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ25vZGF0YSc6XG5cdFx0XHRcdFx0XHRcdFx0Y2FzZSAnZW1wdHknOlxuXHRcdFx0XHRcdFx0XHRcdFx0b2JqID0gZm9ybS5maW5kKG1hdGNoZXNbMV0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKG9iai5jaGlsZHJlbiAmJiBPYmplY3Qua2V5cyhvYmouY2hpbGRyZW4pLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0c2hvdyA9IDA7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignVW5rbm93biBxdWVyeSBzeW50YXg6JywgZmllbGQsICc9JywgIG1lLnNob3dJZltmaWVsZF0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKG1lLnNob3dJZltmaWVsZF0gIT0gZm9ybS5maW5kKGZpZWxkKS52YWx1ZSkgeyAvLyBTdGFuZGFyZCBrZXk9dmFsXG5cdFx0XHRcdFx0XHRcdHNob3cgPSAwO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIG1lLnNob3dJZiA9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0c2hvdyA9IG1lLnNob3dJZi5jYWxsKG1lKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG1lLnNob3coc2hvdywgdXNlckNoYW5nZWQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNob3c6IGZ1bmN0aW9uKHZpc2libGUsIGFuaW1hdGUpIHtcblx0XHRcdGlmICh2aXNpYmxlIHx8IHZpc2libGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAoYW5pbWF0ZSkge1xuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5zbGlkZURvd24oKTtcblx0XHRcdFx0fSBlbHNlIFxuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoYW5pbWF0ZSkge1xuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5zbGlkZVVwKCk7XG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdCh0aGlzLndyYXBwZXIgfHwgdGhpcy5lbGVtZW50KS5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Ly8gVGhpcyBpcyByZWFsbHkganVzdCBhIGR1bWIgYWxpYXMgZm9yIHNob3coMClcblx0XHRoaWRlOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnNob3coZmFsc2UpO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQqIFJ1biBhIGNhbGxiYWNrIGZ1bmN0aW9uIGlmIGl0IGV4aXN0c1xuXHRcdCogQHBhcmFtIHN0cmluZyBuYW1lIHRoZSBuYW1lIG9mIHRoZSBmdW5jdGlvbiAoZS5nLiBpZiAnZm9vJyB0aGUgZnVuY3Rpb24gY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgJ29uRm9vJylcblx0XHQqIEByZXR1cm4gb2JqZWN0IFRoaXMgY2hhaW5hYmxlIG9iamVjdFxuXHRcdCovXG5cdFx0dHJpZ2dlcjogZnVuY3Rpb24obmFtZSkge1xuXHRcdFx0dmFyIGZ1bmNOYW1lID0gJ29uJyArIG5hbWUuc3Vic3RyKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnN1YnN0cigxKTtcblx0XHRcdGlmICh0eXBlb2YgdGhpc1tmdW5jTmFtZV0gPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHR0aGlzW2Z1bmNOYW1lXS5jYWxsKHRoaXMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdub3JtYWwnLFxuXG5cdFx0cmVuZGVyVGFnOiAnPHNlbGVjdD48L3NlbGVjdD4nLFxuXHRcdHJlbmRlckl0ZW06ICc8b3B0aW9uIHZhbHVlPVwie3tkYXRhLl9pZH19XCI+e3tkYXRhLnRpdGxlfX08L29wdGlvbj4nLFxuXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmVsZW1lbnQgPSAkKG1lLnJlbmRlclRhZyk7XG5cdFx0XHRtZS5lbGVtZW50Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0bWUudmFsdWUgPSAkKHRoaXMpLnZhbCgpO1xuXHRcdFx0XHRtZS5jaGFuZ2UuY2FsbChtZSk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdG1lLmxvYWRDb250YWluZXJEYXRhKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZGF0YTtcblx0XHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpXG5cdFx0XHRcdG1lLnJld2luZERhdGEoKTtcblxuXHRcdFx0XHR3aGlsZSAoZGF0YSA9IG1lLmdldERhdGEoKSkge1xuXHRcdFx0XHRcdG1lLmVsZW1lbnQuYXBwZW5kKCQobWUucGFyc2UobWUucmVuZGVySXRlbSkpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtZS52YWx1ZSkge1xuXHRcdFx0XHRcdG1lLmVsZW1lbnQudmFsKG1lLnZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIHsgLy8gTm8gdmFsdWUgLSBzZWxlY3QgdGhlIGZpcnN0XG5cdFx0XHRcdFx0bWUuZWxlbWVudFxuXHRcdFx0XHRcdFx0LnZhbCggbWUuZWxlbWVudC5maW5kKCdvcHRpb246Zmlyc3QnKS5hdHRyKCd2YWx1ZScpIClcblx0XHRcdFx0XHRcdC50cmlnZ2VyKCdjaGFuZ2UnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zdXBlci5zZXR1cC5jYWxsKHRoaXMpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmF0dHIoJ3R5cGUnLCAndGV4dCcpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zdXBlci5yZW5kZXIuY2FsbCh0aGlzKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb2x1bW5zOiB7fSwgLy8gV2hlcmUgdGhlIHJhdyBvYmplY3RzIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIGNoaWxkcmVuIHJlc2lkZVxuXHRcdGNvbHVtbk9yZGVyOiBbXSxcblxuXHRcdHJlbmRlclRhZzogJzx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLWJvcmRlcmVkIHRhYmxlLXN0cmlwZWRcIj48L3RhYmxlPicsXG5cblx0XHRhdXRvSGlkZTogdHJ1ZSxcblxuXHRcdHJlZnJlc2g6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0aWYgKCFtZS5jb2x1bW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNvbHVtbk9yZGVyID0gT2JqZWN0LmtleXMobWUuY29sdW1ucyk7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybignTm8gY29sdW1uT3JkZXIgc3BlY2lmaWVkLiBJbmhlcml0aW5nIGZyb20gY29sdW1ucyBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFtZS5lbGVtZW50KVxuXHRcdFx0XHRtZS5lbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cIndlbGxcIj48aDM+TG9hZGluZyB0YWJsZS4uLjwvaDM+PC9kaXY+Jyk7XG5cblx0XHRcdGlmICghbWUuZGF0YVNvdXJjZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnYmF0dF90YWJsZT4gTm8gZGF0YVNvdXJjZSBzcGVjaWZpZWQgLSBXaGF0IGRpZCB5b3Ugd2FudCBtZSB0byByZW5kZXIgZXhhY3RseT8nLCBtZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZS5sb2FkQ29udGFpbmVyRGF0YShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHQvLyBLaWxsIGFsbCBjaGlsZHJlbiBhbmQgcmVnZW5lcmF0ZVxuXHRcdFx0XHRcdG1lLmNoaWxkcmVuID0ge307XG5cdFx0XHRcdFx0bWUuY2hpbGRyZW5PcmRlciA9IFtdO1xuXG5cdFx0XHRcdFx0dmFyIGRhdGE7XG5cdFx0XHRcdFx0d2hpbGUgKGRhdGEgPSBtZS5nZXREYXRhKCkpIHtcblx0XHRcdFx0XHRcdHZhciByb3dJZCA9IGJhdHQuZ2V0VW5pcXVlSWQoJ2JhdHQtdGFibGUtcm93LScpO1xuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5bcm93SWRdID0gYmF0dC5tYWtlT2JqZWN0KCdjb250YWluZXInKTtcblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuW3Jvd0lkXS5yZW5kZXJUYWcgPSAnPHRyPjwvdHI+Jztcblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIucHVzaChyb3dJZCk7XG5cblx0XHRcdFx0XHRcdG1lLmNoaWxkcmVuW3Jvd0lkXS5zZXQobWUuY29sdW1ucyk7IC8vIENvcHkgY29sdW1uIHByb3RvdHlwZSBpbnRvIG5ldyBjaGlsZFxuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuW3Jvd0lkXS5jaGlsZHJlbikge1xuXHRcdFx0XHRcdFx0XHRtZS5jaGlsZHJlbltyb3dJZF0uY2hpbGRyZW5bY10uY29udGFpbmVyRHJhdyA9ICd0YWJsZS1jZWxsJztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bWUuY2hpbGRyZW5bcm93SWRdLmVhY2hDaGlsZChmdW5jdGlvbigpIHsgLy8gQ29weSBkYXRhIGhhc2ggaW50byBjaGlsZHJlblxuXHRcdFx0XHRcdFx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHRcdFx0bWUuY2hhbmdlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9ICQodGhpcy5yZW5kZXJUYWcpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdFx0dmFyIHJlZHJhdyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRtZS5lbGVtZW50LmVtcHR5KCk7XG5cdFx0XHRcdG1lLnNob3coKTtcblx0XHRcdFx0aWYgKG1lLmNoaWxkcmVuT3JkZXIubGVuZ3RoKSB7IC8vIEhhcyBjaGlsZHJlblxuXHRcdFx0XHRcdHZhciB0YWJsZUhlYWQgPSAkKCc8dHI+PC90cj4nKVxuXHRcdFx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY29sdW1uT3JkZXIpIHtcblx0XHRcdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNvbHVtbnNbbWUuY29sdW1uT3JkZXJbY11dO1xuXHRcdFx0XHRcdFx0dmFyIHRhYmxlQ2VsbCA9ICQoJzx0aD4nICsgKGNoaWxkLmNvbHVtblRpdGxlIHx8IGNoaWxkLnRpdGxlIHx8ICcmbmJzcDsnKSArICc8L3RoPicpXG5cdFx0XHRcdFx0XHRcdC5hcHBlbmRUbyh0YWJsZUhlYWQpO1xuXHRcdFx0XHRcdFx0aWYgKGNoaWxkLmNvbHVtbldpZHRoKVxuXHRcdFx0XHRcdFx0XHR0YWJsZUNlbGwuYXR0cignd2lkdGgnLCBjaGlsZC5jb2x1bW5XaWR0aCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bWUucmV3aW5kRGF0YSgpO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgaW4gbWUuY2hpbGRyZW5PcmRlcikge1xuXHRcdFx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdFx0XHRjaGlsZC5sb2FkRGF0YSgpO1xuXHRcdFx0XHRcdFx0Y2hpbGQuc2V0dXAoKTtcblx0XHRcdFx0XHRcdGNoaWxkLnJlbmRlcigpO1xuXHRcdFx0XHRcdFx0Y2hpbGQuZWxlbWVudC5hcHBlbmRUbyhtZS5lbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAobWUuYXV0b0hpZGUpIHsgLy8gTm8gZGF0YSAtIGhpZGUgdGhlIGVsZW1lbnQgYXV0b21hdGljYWxseT9cblx0XHRcdFx0XHRtZS5oaWRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpZiAobWUuY2hpbGRyZW4ubGVuZ3RoKSB7IC8vIEFscmVhZHkgaGFzIGNoaWxkcmVuIC0gbm8gbmVlZCB0byByZWRyYXdcblx0XHRcdFx0cmVkcmF3KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZS5yZWZyZXNoKHJlZHJhdyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sIHBhcmFtZXRlcnMpO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGFyYW1ldGVycykge1xuXHQkLmV4dGVuZCh0aGlzLCB7XG5cdFx0ZGVmYXVsdDogMCwgLy8gVGhlIGRlZmF1bHQgdGFiIG9mZnNldCB0byBzZWxlY3Rcblx0XHRyZW5kZXJUYWc6ICc8ZGl2PjwvZGl2PicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1lID0gdGhpcztcblx0XHRcdGlmICghbWUuY2hpbGRyZW5PcmRlci5sZW5ndGgpIHsgLy8gSWYgbm8gb3JkZXIgaXMgc3BlY2lmaWVkIGp1c3QgdXNlIHRoZSBvcmRlciBvZiB0aGUgaGFzaCAod2hpY2ggd2lsbCBiZSBhbHBoYWJldGljYWwgaW4gbW9zdCBjYXNlcyAtIGFsc28gcHJvYmFibHkgd3JvbmcpXG5cdFx0XHRcdG1lLmNoaWxkcmVuT3JkZXIgPSBPYmplY3Qua2V5cyhtZS5jaGlsZHJlbik7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTm8gY2hpbGRyZW5PcmRlciBzcGVjaWZpZWQuIEluaGVyaXRpbmcgZnJvbSBjaGlsZHJlbiBoYXNoIGluIGhhc2ggb3JkZXIgaW5zdGVhZCcsIG1lKTtcblx0XHRcdH1cblxuXHRcdFx0bWUuZWxlbWVudC5lbXB0eSgpO1xuXG5cdFx0XHQvLyBEcmF3IHRhYiBzZWxlY3Rpb24gcGFuZSB7e3tcblx0XHRcdHZhciB0YWJIZWFkID0gJCgnPHVsIGNsYXNzPVwibmF2IG5hdi10YWJzXCI+PC91bD4nKVxuXHRcdFx0XHQuYXBwZW5kVG8obWUuZWxlbWVudCk7XG5cdFx0XHRmb3IgKHZhciBjIGluIG1lLmNoaWxkcmVuT3JkZXIpIHtcblx0XHRcdFx0dmFyIGNoaWxkID0gbWUuY2hpbGRyZW5bbWUuY2hpbGRyZW5PcmRlcltjXV07XG5cdFx0XHRcdGNoaWxkLmxpbmtIYXNoID0gYmF0dC5zYWZlU3RyaW5nKGNoaWxkLnRpdGxlKTtcblx0XHRcdFx0dGFiSGVhZC5hcHBlbmQoJzxsaT48YSBocmVmPVwiIycgKyBjaGlsZC5saW5rSGFzaCArICdcIiBkYXRhLXRvZ2dsZT1cInRhYlwiPicgKyBjaGlsZC50aXRsZSArICc8L2E+PC9saT4nKTtcblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXHRcdFx0Ly8gRHJhdyBhY3R1YWwgdGFicyB7e3tcblx0XHRcdHZhciB0YWJCb2R5ID0gJCgnPGRpdiBjbGFzcz1cInRhYi1jb250ZW50XCI+PC9kaXY+Jylcblx0XHRcdFx0LmFwcGVuZFRvKG1lLmVsZW1lbnQpO1xuXHRcdFx0Zm9yICh2YXIgYyBpbiBtZS5jaGlsZHJlbk9yZGVyKSB7XG5cdFx0XHRcdHZhciBjaGlsZCA9IG1lLmNoaWxkcmVuW21lLmNoaWxkcmVuT3JkZXJbY11dO1xuXHRcdFx0XHRjaGlsZC5yZW5kZXIoKTtcblx0XHRcdFx0dmFyIHRhYkNvbnRlbnQgPSAkKCc8ZGl2IGNsYXNzPVwidGFiLXBhbmVcIiBpZD1cIicgKyBjaGlsZC5saW5rSGFzaCArICdcIj48L2Rpdj4nKVxuXHRcdFx0XHRcdC5hcHBlbmRUbyh0YWJCb2R5KTtcblx0XHRcdFx0bWUucmVuZGVyUm93KHRhYkNvbnRlbnQsIGNoaWxkKTtcblx0XHRcdH1cblx0XHRcdC8vIH19fVxuXHRcdFx0Ly8gU2VsZWN0IGRlZmF1bHQgdGFiIHt7e1xuXHRcdFx0dGFiSGVhZC5maW5kKCdhW2RhdGEtdG9nZ2xlPVwidGFiXCJdJykuZXEobWUuZGVmYXVsdCkudGFiKCdzaG93Jyk7XG5cdFx0XHR0YWJCb2R5LmZpbmQoJ2Rpdi50YWItcGFuZScpLmVxKG1lLmRlZmF1bHQpLmFkZENsYXNzKCdhY3RpdmUnKTtcblx0XHRcdC8vIH19fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdGNvbnRhaW5lckRyYXc6ICdub3JtYWwnLFxuXHRcdGFjdGlvbjogJ25vdGhpbmcnLFxuXHRcdGNsYXNzZXM6ICdiYWRnZScsXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc3VwZXIucmVuZGVyLmNhbGwodGhpcyk7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpIHtcblx0JC5leHRlbmQodGhpcywge1xuXHRcdHJlbmRlclRhZzogJzx0ZXh0YXJlYT48L3RleHRhcmVhPicsXG5cblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSAkKHRoaXMucmVuZGVyVGFnKVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnRcblx0XHRcdFx0Lmh0bWwodGhpcy52YWx1ZSlcblx0XHRcdFx0Lm9uKCdjaGFuZ2UnLCB0aGlzLmNoYW5nZSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0Y2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmVsZW1lbnQudmFsKCk7XG5cdFx0XHR0aGlzLnN1cGVyLmNoYW5nZS5jYWxsKHRoaXMpO1xuXHRcdH1cblx0fSwgcGFyYW1ldGVycyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKSB7XG5cdCQuZXh0ZW5kKHRoaXMsIHtcblx0XHRjb250YWluZXJEcmF3OiAnc3BhbicsXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cImFsZXJ0IGFsZXJ0LWRhbmdlclwiPjxpIGNsYXNzPVwiaWNvbi13YXJuaW5nLXNpZ25cIj48L2k+IElEOiBcXCcnICsgdGhpcy5pZCArICdcXCcgQXR0ZW1wdGVkIHRvIGxvYWQgbm9uZS1leGlzdGFudCBCYXR0IGZvcm0gdHlwZSBcXCcnICsgdGhpcy50eXBlRmFpbGVkICsgJ1xcJzwvZGl2PicpO1xuXHRcdFx0aWYgKHRoaXMuY2hpbGRyZW4pIHtcblx0XHRcdFx0Zm9yICh2YXIgYyBpbiB0aGlzLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0dmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltjXTtcblx0XHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kKCc8YnIvPjxzdHJvbmc+Q0hJTEQ6PC9zdHJvbmc+ICcgKyBjaGlsZC50eXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHNldDogZnVuY3Rpb24oKSB7XG5cdFx0XHQvLyBOby1vcFxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LCBwYXJhbWV0ZXJzKTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG4iXX0=
;