//
// Begin anonymous function. This is used to contain local scope variables without polutting global scope.
//
var util = require('util'),
	XRegExp = require('./XRegExp').XRegExp,
	DOM = require('htmlparser').DomUtils;

// Shortcut object which will be assigned to the SyntaxHighlighter variable.
// This is a shorthand for local reference in order to avoid long namespace
// references to SyntaxHighlighter.whatever...
var sh = {
	defaults : {
		/** Additional CSS class names to be added to highlighter elements. */
		'class-name' : '',

		/** First line number. */
		'first-line' : 1,

		/**
		 * Pads line numbers. Possible values are:
		 *
		 *   false - don't pad line numbers.
		 *   true  - automaticaly pad numbers with minimum required number of leading zeroes.
		 *   [int] - length up to which pad line numbers.
		 */
		'pad-line-numbers' : false,

		/** Lines to highlight. */
		'highlight' : null,

		/** Title to be displayed above the code block. */
		'title' : null,

		/** Enables or disables smart tabs. */
		'smart-tabs' : true,

		/** Gets or sets tab size. */
		'tab-size' : 4,

		/** Enables or disables gutter. */
		'gutter' : true,

		/** Enables or disables automatic links. */
		'auto-links' : true,

		'unindent' : true,

		'html-script' : false
	},

	config : {
		space : '&nbsp;',

		/** Enables use of <SCRIPT type="syntaxhighlighter" /> tags. */
		useScriptTags : true,

		/** Blogger mode flag. */
		bloggerMode : false,

		stripBrs : false,

		/** Name of the tag that SyntaxHighlighter will automatically look for. */
		tagName : 'pre',

		strings : {
			expandSource : 'expand source',
			help : '?',
			noBrush : 'Can\'t find brush for: ',
			brushNotHtmlScript : 'Brush wasn\'t configured for html-script option: '
		}
	},

	/** Internal 'global' variables. */
	vars : {
		discoveredBrushes : null
	},

	/** This object is populated by user included external brush files. */
	brushes : {},

	/** Common regular expressions. */
	regexLib : {
		multiLineCComments			: /\/\*[\s\S]*?\*\//gm,
		singleLineCComments			: /\/\/.*$/gm,
		singleLinePerlComments		: /#.*$/gm,
		doubleQuotedString			: /"([^\\"\n]|\\.)*"/g,
		singleQuotedString			: /'([^\\'\n]|\\.)*'/g,
		multiLineDoubleQuotedString	: new XRegExp('"([^\\\\"]|\\\\.)*"', 'gs'),
		multiLineSingleQuotedString	: new XRegExp("'([^\\\\']|\\\\.)*'", 'gs'),
		xmlComments					: /(&lt;|<)!--[\s\S]*?--(&gt;|>)/gm,
		url							: /\w+:\/\/[\w-.\/?%&=:@;#]*/g,

		/** <?= ?> tags. */
		phpScriptTags 				: { left: /(&lt;|<)\?(?:=|php)?/g, right: /\?(&gt;|>)/g, 'eof' : true },

		/** <%= %> tags. */
		aspScriptTags				: { left: /(&lt;|<)%=?/g, right: /%(&gt;|>)/g },

		/** <script> tags. */
		scriptScriptTags			: { left: /(&lt;|<)\s*script.*?(&gt;|>)/gi, right: /(&lt;|<)\/\s*script\s*(&gt;|>)/gi }
	},

	/**
	 * Finds all elements on the page which should be processes by SyntaxHighlighter.
	 *
	 * @param {Object} globalParams		Optional parameters which override element's
	 * 									parameters. Only used if element is specified.
	 *
	 * @param {Object} element	Optional element to highlight. If none is
	 * 							provided, all elements in the current document
	 * 							are returned which qualify.
	 *
	 * @return {Array}	Returns list of <code>{ target: DOMElement, params: Object }</code> objects.
	 */
	findElements: function(dom, globalParams, element) {
		var elements = element ? [element] : DOM.getElementsByTagName(sh.config.tagName, dom),
			conf = sh.config,
			result = []
			;

		// support for <SCRIPT TYPE="syntaxhighlighter" /> feature
		if (conf.useScriptTags) {
			elements = elements.concat(getSyntaxHighlighterScriptTags(dom));
		}

		if (elements.length === 0) {
			return result;
		}

		elements.forEach(function(element) {
			var item = {
				target: element,
				// local params take precedence over globals
				params: merge(globalParams, parseParams(element.attribs && element.attribs.class))
			};

			if (item.params['brush'] == null) {
				return;
			}

			result.push(item);
		});

		return result;
	},

	/**
	 * Shorthand to highlight all elements on the page that are marked as
	 * SyntaxHighlighter source code.
	 *
	 * @param {Object} globalParams		Optional parameters which override element's
	 * 									parameters. Only used if element is specified.
	 *
	 * @param {Object} element	Optional element to highlight. If none is
	 * 							provided, all elements in the current document
	 * 							are highlighted.
	 */
	highlight: function(dom, globalParams, element) {
		var elements = this.findElements(dom, globalParams, element),
			highlighter = null,
			conf = sh.config
			;

		if (elements.length === 0) {
			return;
		}

		elements.forEach(function(element) {
			var target = element.target,
				params = element.params,
				brushName = params.brush,
				title,
				code
				;

			// point back
			target.wrapper = element;

			if (brushName == null) {
				return;
			}

			// Instantiate a brush
			if (params['html-script'] === 'true' || sh.defaults['html-script'] === true) {
				highlighter = new sh.HtmlScript(brushName);
				brushName = 'htmlscript';
			} else {
				var brush = findBrush(brushName);

				if (brush) {
					highlighter = new brush();
				} else {
					return;
				}
			}

			if (!(code = getInnerHtml(target))) {
				return;
			}

			// remove CDATA from <SCRIPT/> tags if it's present
			if (conf.useScriptTags) {
				code = stripCData(code);
			}

			// Inject title if the attribute is present
			if (title = getAttribute(target, 'title')) {
				params.title = title;
			}

			params['brush'] = brushName;
			highlighter.init(params);
			element.html = highlighter.getHtml(code);
		});

		return elements;
	}

}; // end of sh

function getAttribute(ele, name) {
	var attrs, ret;
	if (ele && (attrs = ele.attribs)) {
		ret = attrs[name];
	}

	return ret;
}

/**
 * Splits block of text into lines.
 * @param {String} block Block of text.
 * @return {Array} Returns array of lines.
 */
function splitLines(block) {
	return block.split(/\r?\n/);
}

/**
 * Generates a unique element ID.
 */
function guid(prefix) {
	return (prefix || '') + Math.round(Math.random() * 1000000).toString();
}

/**
 * Merges two objects. Values from obj2 override values in obj1.
 * Function is NOT recursive and works only for one dimensional objects.
 * @param {Object} obj1 First object.
 * @param {Object} obj2 Second object.
 * @return {Object} Returns combination of both objects.
 */
function merge(obj1, obj2) {
	var result = {}, name;

	for (name in obj1) {
		result[name] = obj1[name];
	}

	for (name in obj2) {
		result[name] = obj2[name];
	}

	return result;
}

/**
 * Attempts to convert string to boolean.
 * @param {String} value Input string.
 * @return {Boolean} Returns true if input was "true", false if input was "false" and value otherwise.
 */
function toBoolean(value) {
	var result = { "true" : true, "false" : false }[value];
	return result == null ? value : result;
}

/**
 * Finds a brush by its alias.
 *
 * @param {String} alias		Brush alias.
 * @param {Boolean} showAlert	Suppresses the alert if false.
 * @return {Brush}				Returns bursh constructor if found, null otherwise.
 */
function findBrush(alias, showAlert) {
	var brushes = sh.vars.discoveredBrushes,
		result = null
		;

	if (brushes == null) {
		brushes = {};

		// Find all brushes
		for (var brush in sh.brushes) {
			var info = sh.brushes[brush],
				aliases = info.aliases
				;

			if (aliases == null) {
				continue;
			}

			// keep the brush name
			info.brushName = brush.toLowerCase();

			aliases.forEach(function(aliase) {
				brushes[aliase] = brush;
			});
		}

		sh.vars.discoveredBrushes = brushes;
	}

	result = sh.brushes[brushes[alias]];

	if (result == null && showAlert) {
		throw new Error(sh.config.strings.noBrush + alias);
	}

	return result;
}

/**
 * Executes a callback on each line and replaces each line with result from the callback.
 * @param {Object} str			Input string.
 * @param {Object} callback		Callback function taking one string argument and returning a string.
 */
function eachLine(str, callback) {
	var lines = splitLines(str);

	for (var i = 0; i < lines.length; i++)
		lines[i] = callback(lines[i], i);

	// include \r to enable copy-paste on windows (ie8) without getting everything on one line
	return lines.join('\r\n');
}

/**
 * This is a special trim which only removes first and last empty lines
 * and doesn't affect valid leading space on the first line.
 *
 * @param {String} str   Input string
 * @return {String}      Returns string without empty first and last lines.
 */
function trimFirstAndLastLines(str) {
	return str.replace(/^[ ]*[\n]+|[\n]*[ ]*$/g, '');
}

/**
 * Parses key/value pairs into hash object.
 *
 * Understands the following formats:
 * - name: word;
 * - name: [word, word];
 * - name: "string";
 * - name: 'string';
 *
 * For example:
 *   name1: value; name2: [value, value]; name3: 'value'
 *
 * @param {String} str    Input string.
 * @return {Object}       Returns deserialized object.
 */
function parseParams(str) {
	var match,
		result = {},
		arrayRegex = new XRegExp("^\\[(?<values>(.*?))\\]$"),
		regex = new XRegExp(
			"(?<name>[\\w-]+)" +
			"\\s*:\\s*" +
			"(?<value>" +
				"[\\w-%#]+|" +		// word
				"\\[.*?\\]|" +		// [] array
				'".*?"|' +			// "" string
				"'.*?'" +			// '' string
			")\\s*;?",
			"g"
		)
		;

	while ((match = regex.exec(str)) != null)
	{
		var value = match.value
			.replace(/^['"]|['"]$/g, '') // strip quotes from end of strings
			;

		// try to parse array value
		if (value != null && arrayRegex.test(value))
		{
			var m = arrayRegex.exec(value);
			value = m.values.length > 0 ? m.values.split(/\s*,\s*/) : [];
		}

		result[match.name] = value;
	}

	return result;
}

/**
 * Wraps each line of the string into <code/> tag with given style applied to it.
 *
 * @param {String} str   Input string.
 * @param {String} css   Style name to apply to the string.
 * @return {String}      Returns input string with each line surrounded by <span/> tag.
 */
function wrapLinesWithCode(str, css) {
	if (str == null || str.length == 0 || str == '\n')
		return str;

	str = str.replace(/</g, '&lt;');

	// Replace two or more sequential spaces with &nbsp; leaving last space untouched.
	str = str.replace(/ {2,}/g, function(m)
	{
		var spaces = '';

		for (var i = 0; i < m.length - 1; i++)
			spaces += sh.config.space;

		return spaces + ' ';
	});

	// Split each line and apply <span class="...">...</span> to them so that
	// leading spaces aren't included.
	if (css != null)
		str = eachLine(str, function(line)
		{
			if (line.length == 0)
				return '';

			var spaces = '';

			line = line.replace(/^(&nbsp;| )+/, function(s)
			{
				spaces = s;
				return '';
			});

			if (line.length == 0)
				return spaces;

			return spaces + '<code class="' + css + '">' + line + '</code>';
		});

	return str;
}

/**
 * Pads number with zeros until it's length is the same as given length.
 *
 * @param {Number} number	Number to pad.
 * @param {Number} length	Max string length with.
 * @return {String}			Returns a string padded with proper amount of '0'.
 */
function padNumber(number, length) {
	var result = number.toString();

	while (result.length < length)
		result = '0' + result;

	return result;
}

/**
 * Replaces tabs with spaces.
 *
 * @param {String} code		Source code.
 * @param {Number} tabSize	Size of the tab.
 * @return {String}			Returns code with all tabs replaces by spaces.
 */
function processTabs(code, tabSize) {
	var tab = '';

	for (var i = 0; i < tabSize; i++)
		tab += ' ';

	return code.replace(/\t/g, tab);
}

/**
 * Replaces tabs with smart spaces.
 *
 * @param {String} code    Code to fix the tabs in.
 * @param {Number} tabSize Number of spaces in a column.
 * @return {String}        Returns code with all tabs replaces with roper amount of spaces.
 */
function processSmartTabs(code, tabSize) {
	var lines = splitLines(code),
		tab = '\t',
		spaces = ''
		;

	// Create a string with 1000 spaces to copy spaces from...
	// It's assumed that there would be no indentation longer than that.
	for (var i = 0; i < 50; i++)
		spaces += '                    '; // 20 spaces * 50

	// This function inserts specified amount of spaces in the string
	// where a tab is while removing that given tab.
	function insertSpaces(line, pos, count) {
		return line.substr(0, pos)
			+ spaces.substr(0, count)
			+ line.substr(pos + 1, line.length) // pos + 1 will get rid of the tab
			;
	}

	// Go through all the lines and do the 'smart tabs' magic.
	code = eachLine(code, function(line) {
		if (line.indexOf(tab) == -1)
			return line;

		var pos = 0;

		while ((pos = line.indexOf(tab)) != -1) {
			// This is pretty much all there is to the 'smart tabs' logic.
			// Based on the position within the line and size of a tab,
			// calculate the amount of spaces we need to insert.
			var spaces = tabSize - pos % tabSize;
			line = insertSpaces(line, pos, spaces);
		}

		return line;
	});

	return code;
}

/**
 * Performs various string fixes based on configuration.
 */
function fixInputString(str) {
	var br = /<br\s*\/?>|&lt;br\s*\/?&gt;/gi;

	if (sh.config.bloggerMode == true)
		str = str.replace(br, '\n');

	if (sh.config.stripBrs == true)
		str = str.replace(br, '');

	return str;
}

/**
 * Unindents a block of text by the lowest common indent amount.
 * @param {String} str   Text to unindent.
 * @return {String}      Returns unindented text block.
 */
function unindent(str) {
	var lines = splitLines(fixInputString(str)),
		indents = new Array(),
		regex = /^\s*/,
		min = 1000
		;

	// go through every line and check for common number of indents
	for (var i = 0; i < lines.length && min > 0; i++) {
		var line = lines[i];

		if (line.trim().length == 0) {
			continue;
		}

		var matches = regex.exec(line);

		// In the event that just one line doesn't have leading white space
		// we can't unindent anything, so bail completely.
		if (matches == null)
			return str;

		min = Math.min(matches[0].length, min);
	}

	// trim minimum common number of white space from the begining of every line
	if (min > 0)
		for (var i = 0; i < lines.length; i++)
			lines[i] = lines[i].substr(min);

	return lines.join('\n');
}

/**
 * Callback method for Array.sort() which sorts matches by
 * index position and then by length.
 *
 * @param {Match} m1	Left object.
 * @param {Match} m2    Right object.
 * @return {Number}     Returns -1, 0 or -1 as a comparison result.
 */
function matchesSortCallback(m1, m2) {
	// sort matches by index first
	if(m1.index < m2.index)
		return -1;
	else if(m1.index > m2.index)
		return 1;
	else {
		// if index is the same, sort by length
		if(m1.length < m2.length)
			return -1;
		else if(m1.length > m2.length)
			return 1;
	}

	return 0;
}

/**
 * Executes given regular expression on provided code and returns all
 * matches that are found.
 *
 * @param {String} code    Code to execute regular expression on.
 * @param {Object} regex   Regular expression item info from <code>regexList</code> collection.
 * @return {Array}         Returns a list of Match objects.
 */
function getMatches(code, regexInfo) {
	function defaultAdd(match, regexInfo) {
		return match[0];
	}

	var index = 0,
		match = null,
		matches = [],
		func = regexInfo.func ? regexInfo.func : defaultAdd
		;

	while((match = regexInfo.regex.exec(code)) != null) {
		var resultMatch = func(match, regexInfo);

		if (typeof(resultMatch) == 'string')
			resultMatch = [new sh.Match(resultMatch, match.index, regexInfo.css)];

		matches = matches.concat(resultMatch);
	}

	return matches;
};

/**
 * Turns all URLs in the code into <a/> tags.
 * @param {String} code Input code.
 * @return {String} Returns code with </a> tags.
 */
function processUrls(code) {
	var gt = /(.*)((&gt;|&lt;).*)/;

	return code.replace(sh.regexLib.url, function(m)
	{
		var suffix = '',
			match = null
			;

		// We include &lt; and &gt; in the URL for the common cases like <http://google.com>
		// The problem is that they get transformed into &lt;http://google.com&gt;
		// Where as &gt; easily looks like part of the URL string.

		if (match = gt.exec(m))
		{
			m = match[1];
			suffix = match[2];
		}

		return '<a href="' + m + '">' + m + '</a>' + suffix;
	});
}

/**
 * Finds all <SCRIPT TYPE="syntaxhighlighter" /> elementss.
 * @return {Array} Returns array of all found SyntaxHighlighter tags.
 */
function getSyntaxHighlighterScriptTags(dom) {
	var scripts = DOM.getElementsByTagName('script', dom),
		result = []
		;

	scripts.forEach(function(script) {
		var attr;
		if ((attr = script.attribs) && attr.type === 'syntaxhighlighter') {
			result.push(script);
		}
	});

	return result;
}

/**
 * Strips <![CDATA[]]> from <SCRIPT /> content because it should be used
 * there in most cases for XHTML compliance.
 * @param {String} original	Input code.
 * @return {String} Returns code without leading <![CDATA[]]> tags.
 */
function stripCData(original) {
	var left = '<![CDATA[',
		right = ']]>',
		// for some reason IE inserts some leading blanks here
		copy = original.trim(),
		changed = false,
		leftLength = left.length,
		rightLength = right.length
		;

	if (copy.indexOf(left) == 0)
	{
		copy = copy.substring(leftLength);
		changed = true;
	}

	var copyLength = copy.length;

	if (copy.indexOf(right) == copyLength - rightLength)
	{
		copy = copy.substring(0, copyLength - rightLength);
		changed = true;
	}

	return changed ? copy : original;
}

function getInnerHtml(ele) {
    var html = '';
    if (ele.type === 'text') {
        html = ele.raw;
    } else {
        if (ele.children) {
            ele.children.forEach(function(child) {
                html += getHtml(child);
            });
        } else {
            html = ele.raw;
        }
    }

    return html;
}

function getHtml(ele) {
    var html = '';

    if (ele.type !== 'text' && ele.children) {
        html += '<' + ele.name + '>';
        ele.children.forEach(function(child) {
            html += getHtml(child);
        });
        html += '</' + ele.name + '>';
    } else {
        html += ele.raw;
    }

    return html;
}

/**
 * Match object.
 */
sh.Match = function(value, index, css) {
	this.value = value;
	this.index = index;
	this.length = value.length;
	this.css = css;
	this.brushName = null;
};

sh.Match.prototype.toString = function() {
	return this.value;
};

/**
 * Simulates HTML code with a scripting language embedded.
 *
 * @param {String} scriptBrushName Brush name of the scripting language.
 */
sh.HtmlScript = function(scriptBrushName) {
	var brushClass = findBrush(scriptBrushName),
		scriptBrush,
		xmlBrush = new sh.brushes.Xml(),
		bracketsRegex = null,
		ref = this,
		methodsToExpose = 'getHtml init'.split(' ')
		;

	if (brushClass == null) {
		return;
	}

	scriptBrush = new brushClass();

	methodsToExpose.forEach(function(method) {
		ref[method] = function() {
			return xmlBrush[method].apply(xmlBrush, arguments);
		};
	});

	if (scriptBrush.htmlScript == null) {
		throw new Error(sh.config.strings.brushNotHtmlScript + scriptBrushName);
	}

	xmlBrush.regexList.push(
		{ regex: scriptBrush.htmlScript.code, func: process }
	);

	function offsetMatches(matches, offset) {
		matches.forEach(function(match) {
			match.index += offset;
		});
	}

	function process(match, info) {
		var code = match.code,
			matches = [],
			regexList = scriptBrush.regexList,
			offset = match.index + match.left.length,
			htmlScript = scriptBrush.htmlScript,
			result
			;

		// add all matches from the code
		regexList.forEach(function(regex) {
			result = getMatches(code, regex);
			offsetMatches(result, offset);
			matches = matches.concat(result);
		});

		// add left script bracket
		if (htmlScript.left != null && match.left != null) {
			result = getMatches(match.left, htmlScript.left);
			offsetMatches(result, match.index);
			matches = matches.concat(result);
		}

		// add right script bracket
		if (htmlScript.right != null && match.right != null) {
			result = getMatches(match.right, htmlScript.right);
			offsetMatches(result, match.index + match[0].lastIndexOf(match.right));
			matches = matches.concat(result);
		}

		matches.forEach(function(match) {
			match.brushName = brushClass.brushName;
		});

		return matches;
	}
};

/**
 * Main Highlither class.
 * @constructor
 */
sh.Highlighter = function() {
	// not putting any code in here because of the prototype inheritance
};

sh.Highlighter.prototype = {
	/**
	 * Returns value of the parameter passed to the highlighter.
	 * @param {String} name				Name of the parameter.
	 * @param {Object} defaultValue		Default value.
	 * @return {Object}					Returns found value or default value otherwise.
	 */
	getParam: function(name, defaultValue) {
		var result = this.params[name];
		return toBoolean(result == null ? defaultValue : result);
	},

	/**
	 * Shortcut to document.createElement().
	 * @param {String} name		Name of the element to create (DIV, A, etc).
	 * @return {HTMLElement}	Returns new HTML element.
	 */
	create: function(name) {
		return document.createElement(name);
	},

	/**
	 * Applies all regular expression to the code and stores all found
	 * matches in the `this.matches` array.
	 * @param {Array} regexList		List of regular expressions.
	 * @param {String} code			Source code.
	 * @return {Array}				Returns list of matches.
	 */
	findMatches: function(regexList, code) {
		var result = [];

		if (regexList != null)
			for (var i = 0; i < regexList.length; i++)
				// BUG: length returns len+1 for array if methods added to prototype chain (oising@gmail.com)
				if (typeof (regexList[i]) == "object")
					result = result.concat(getMatches(code, regexList[i]));

		// sort and remove nested the matches
		return this.removeNestedMatches(result.sort(matchesSortCallback));
	},

	/**
	 * Checks to see if any of the matches are inside of other matches.
	 * This process would get rid of highligted strings inside comments,
	 * keywords inside strings and so on.
	 */
	removeNestedMatches: function(matches) {
		// Optimized by Jose Prado (http://joseprado.com)
		for (var i = 0; i < matches.length; i++) {
			if (matches[i] === null) {
				continue;
			}

			var itemI = matches[i],
				itemIEndPos = itemI.index + itemI.length
				;

			for (var j = i + 1; j < matches.length && matches[i] !== null; j++) {
				var itemJ = matches[j];

				if (itemJ === null) {
					continue;
				} else if (itemJ.index > itemIEndPos) {
					break;
				} else if (itemJ.index == itemI.index && itemJ.length > itemI.length) {
					matches[i] = null;
				} else if (itemJ.index >= itemI.index && itemJ.index < itemIEndPos) {
					matches[j] = null;
				}
			}
		}

		return matches;
	},

	/**
	 * Creates an array containing integer line numbers starting from the 'first-line' param.
	 * @return {Array} Returns array of integers.
	 */
	figureOutLineNumbers: function(code) {
		var lines = [],
			firstLine = parseInt(this.getParam('first-line'))
			;

		eachLine(code, function(line, index) {
			lines.push(index + firstLine);
		});

		return lines;
	},

	/**
	 * Determines if specified line number is in the highlighted list.
	 */
	isLineHighlighted: function(lineNumber) {
		var list = this.getParam('highlight', []);

		if (typeof list !== 'object' && !util.isArray(list)) {
			list = [ list ];
		}

		return list.indexOf('' + lineNumber) > -1;
	},

	/**
	 * Generates HTML markup for a single line of code while determining alternating line style.
	 * @param {Integer} lineNumber	Line number.
	 * @param {String} code Line	HTML markup.
	 * @return {String}				Returns HTML markup.
	 */
	getLineHtml: function(lineIndex, lineNumber, code) {
		var classes = [
			'line',
			'number' + lineNumber,
			'index' + lineIndex,
			'alt' + lineNumber % 2 == 0 ? 1 : 2
		];

		if (this.isLineHighlighted(lineNumber)) {
		 	classes.push('highlighted');
		}

		if (lineNumber == 0) {
			classes.push('break');
		}

		return '<div class="' + classes.join(' ') + '">' + code + '</div>';
	},

	/**
	 * Generates HTML markup for line number column.
	 * @param {String} code			Complete code HTML markup.
	 * @param {Array} lineNumbers	Calculated line numbers.
	 * @return {String}				Returns HTML markup.
	 */
	getLineNumbersHtml: function(code, lineNumbers) {
		var html = '',
			count = splitLines(code).length,
			firstLine = parseInt(this.getParam('first-line')),
			pad = this.getParam('pad-line-numbers')
			;

		if (pad == true)
			pad = (firstLine + count - 1).toString().length;
		else if (isNaN(pad) == true)
			pad = 0;

		for (var i = 0; i < count; i++) {
			var lineNumber = lineNumbers ? lineNumbers[i] : firstLine + i,
				code = lineNumber == 0 ? sh.config.space : padNumber(lineNumber, pad)
				;

			html += this.getLineHtml(i, lineNumber, code);
		}

		return html;
	},

	/**
	 * Splits block of text into individual DIV lines.
	 * @param {String} code			Code to highlight.
	 * @param {Array} lineNumbers	Calculated line numbers.
	 * @return {String}				Returns highlighted code in HTML form.
	 */
	getCodeLinesHtml: function(html, lineNumbers) {
		html = html.trim();

		var lines = splitLines(html),
			padLength = this.getParam('pad-line-numbers'),
			firstLine = parseInt(this.getParam('first-line')),
			html = '',
			brushName = this.getParam('brush')
			;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i],
				indent = /^(&nbsp;|\s)+/.exec(line),
				spaces = null,
				lineNumber = lineNumbers ? lineNumbers[i] : firstLine + i;
				;

			if (indent != null) {
				spaces = indent[0].toString();
				line = line.substr(spaces.length);
				spaces = spaces.replace(' ', sh.config.space);
			}

			line = line.trim();

			if (line.length == 0)
				line = sh.config.space;

			html += this.getLineHtml(
				i,
				lineNumber,
				(spaces != null ? '<code class="' + brushName + ' spaces">' + spaces + '</code>' : '') + line
			);
		}

		return html;
	},

	/**
	 * Returns HTML for the table title or empty string if title is null.
	 */
	getTitleHtml: function(title) {
		return title ? '<caption>' + title + '</caption>' : '';
	},

	/**
	 * Finds all matches in the source code.
	 * @param {String} code		Source code to process matches in.
	 * @param {Array} matches	Discovered regex matches.
	 * @return {String} Returns formatted HTML with processed mathes.
	 */
	getMatchesHtml: function(code, matches) {
		var pos = 0,
			result = '',
			brushName = this.getParam('brush', '')
			;

		function getBrushNameCss(match) {
			var result = match ? (match.brushName || brushName) : brushName;
			return result ? result + ' ' : '';
		};

		// Finally, go through the final list of matches and pull the all
		// together adding everything in between that isn't a match.
		for (var i = 0; i < matches.length; i++) {
			var match = matches[i],
				matchBrushName
				;

			if (match === null || match.length === 0) {
				continue;
			}

			matchBrushName = getBrushNameCss(match);

			result += wrapLinesWithCode(code.substr(pos, match.index - pos), matchBrushName + 'plain')
					+ wrapLinesWithCode(match.value, matchBrushName + match.css)
					;

			pos = match.index + match.length + (match.offset || 0);
		}

		// don't forget to add whatever's remaining in the string
		result += wrapLinesWithCode(code.substr(pos), getBrushNameCss() + 'plain');

		return result;
	},

	/**
	 * Generates HTML markup for the whole syntax highlighter.
	 * @param {String} code Source code.
	 * @return {String} Returns HTML markup.
	 */
	getHtml: function(code) {
		var html = '',
			classes = [ 'syntaxhighlighter' ],
			tabSize,
			matches,
			lineNumbers
			;

		if ((gutter = this.getParam('gutter')) == false) {
			classes.push('nogutter');
		}

		// add custom user style name
		classes.push(this.getParam('class-name'));

		// add brush alias to the class name for custom CSS
		classes.push(this.getParam('brush'));

		code = trimFirstAndLastLines(code)
			.replace(/\r/g, ' ') // IE lets these buggers through
			;

		tabSize = this.getParam('tab-size');

		// replace tabs with spaces
		code = this.getParam('smart-tabs') == true
			? processSmartTabs(code, tabSize)
			: processTabs(code, tabSize)
			;

		// unindent code by the common indentation
		if (this.getParam('unindent')) {
			code = unindent(code);
		}

		if (gutter) {
			lineNumbers = this.figureOutLineNumbers(code);
		}

		// find matches in the code using brushes regex list
		matches = this.findMatches(this.regexList, code);
		// processes found matches into the html
		html = this.getMatchesHtml(code, matches);
		// finally, split all lines so that they wrap well
		html = this.getCodeLinesHtml(html, lineNumbers);

		// finally, process the links
		if (this.getParam('auto-links')) {
			html = processUrls(html);
		}

		// @TODO IE detection

		html =
			'<div class="' + classes.join(' ') + '">'
				+ '<table border="0" cellpadding="0" cellspacing="0">'
					+ this.getTitleHtml(this.getParam('title'))
					+ '<tbody>'
						+ '<tr>'
							+ (gutter ? '<td class="gutter">' + this.getLineNumbersHtml(code) + '</td>' : '')
							+ '<td class="code">'
								+ '<div class="container">'
									+ html
								+ '</div>'
							+ '</td>'
						+ '</tr>'
					+ '</tbody>'
				+ '</table>'
			+ '</div>'
			;

		return html;
	},

	/**
	 * Initializes the highlighter/brush.
	 *
	 * Constructor isn't used for initialization so that nothing executes during necessary
	 * `new SyntaxHighlighter.Highlighter()` call when setting up brush inheritence.
	 *
	 * @param {Hash} params Highlighter parameters.
	 */
	init: function(params) {

		// local params take precedence over defaults
		this.params = merge(sh.defaults, params || {})

	},

	/**
	 * Converts space separated list of keywords into a regular expression string.
	 * @param {String} str    Space separated keywords.
	 * @return {String}       Returns regular expression string.
	 */
	getKeywords: function(str) {
		str = str
			.replace(/^\s+|\s+$/g, '')
			.replace(/\s+/g, '|')
			;

		return '\\b(?:' + str + ')\\b';
	},

	/**
	 * Makes a brush compatible with the `html-script` functionality.
	 * @param {Object} regexGroup Object containing `left` and `right` regular expressions.
	 */
	forHtmlScript: function(regexGroup) {
		var regex = { 'end' : regexGroup.right.source };

		if(regexGroup.eof)
			regex.end = "(?:(?:" + regex.end + ")|$)";

		this.htmlScript = {
			left : { regex: regexGroup.left, css: 'script' },
			right : { regex: regexGroup.right, css: 'script' },
			code : new XRegExp(
				"(?<left>" + regexGroup.left.source + ")" +
				"(?<code>.*?)" +
				"(?<right>" + regex.end + ")",
				"sgi"
				)
		};
	}
}; // end of Highlighter

exports.SyntaxHighlighter = sh;
