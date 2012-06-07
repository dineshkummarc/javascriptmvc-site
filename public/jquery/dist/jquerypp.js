(function( $ ) {

	var getComputedStyle = document.defaultView && document.defaultView.getComputedStyle,
		// The following variables are used to convert camelcased attribute names
		// into dashed names, e.g. borderWidth to border-width
		rupper = /([A-Z])/g,
		rdashAlpha = /-([a-z])/ig,
		fcamelCase = function( all, letter ) {
			return letter.toUpperCase();
		},
		// Returns the computed style for an elementn
		getStyle = function( elem ) {
			if ( getComputedStyle ) {
				return getComputedStyle(elem, null);
			}
			else if ( elem.currentStyle ) {
				return elem.currentStyle;
			}
		},
		// Checks for float px and numeric values
		rfloat = /float/i,
		rnumpx = /^-?\d+(?:px)?$/i,
		rnum = /^-?\d/;

	// Returns a list of styles for a given element
	$.styles = function( el, styles ) {
		if (!el ) {
			return null;
		}
		var  currentS = getStyle(el),
			oldName, val, style = el.style,
			results = {},
			i = 0,
			left, rsLeft, camelCase, name;

		// Go through each style
		for (; i < styles.length; i++ ) {
			name = styles[i];
			oldName = name.replace(rdashAlpha, fcamelCase);

			if ( rfloat.test(name) ) {
				name = jQuery.support.cssFloat ? "float" : "styleFloat";
				oldName = "cssFloat";
			}

			// If we have getComputedStyle available
			if ( getComputedStyle ) {
				// convert camelcased property names to dashed name
				name = name.replace(rupper, "-$1").toLowerCase();
				// use getPropertyValue of the current style object
				val = currentS.getPropertyValue(name);
				// default opacity is 1
				if ( name === "opacity" && val === "" ) {
					val = "1";
				}
				results[oldName] = val;
			} else {
				// Without getComputedStyles
				camelCase = name.replace(rdashAlpha, fcamelCase);
				results[oldName] = currentS[name] || currentS[camelCase];

				// convert to px
				if (!rnumpx.test(results[oldName]) && rnum.test(results[oldName]) ) {
					// Remember the original values
					left = style.left;
					rsLeft = el.runtimeStyle.left;

					// Put in the new values to get a computed value out
					el.runtimeStyle.left = el.currentStyle.left;
					style.left = camelCase === "fontSize" ? "1em" : (results[oldName] || 0);
					results[oldName] = style.pixelLeft + "px";

					// Revert the changed values
					style.left = left;
					el.runtimeStyle.left = rsLeft;
				}

			}
		}

		return results;
	};

	/**
	 * @function jQuery.fn.styles
	 * @parent jQuery.styles
	 * @plugin jQuery.styles
	 *
	 * Returns a set of computed styles. Pass the names of the styles you want to
	 * retrieve as arguments:
	 *
	 *      $("div").styles('float','display')
	 *      // -> { cssFloat: "left", display: "block" }
	 *
	 * @param {String} style pass the names of the styles to retrieve as the argument list
	 * @return {Object} an object of `style` : `value` pairs
	 */
	$.fn.styles = function() {
		// Pass the arguments as an array to $.styles
		return $.styles(this[0], $.makeArray(arguments));
	};
})(jQuery);
(function ($) {

	// Overwrites `jQuery.fn.animate` to use CSS 3 animations if possible

	var
		// The global animation counter
		animationNum = 0,
		// The stylesheet for our animations
		styleSheet = null,
		// The animation cache
		cache = [],
		// Stores the browser properties like transition end event name and prefix
		browser = null,
		// Store the original $.fn.animate
		oldanimate = $.fn.animate,

		// Return the stylesheet, create it if it doesn't exists
		getStyleSheet = function () {
			if(!styleSheet) {
				var style = document.createElement('style');
				style.setAttribute("type", "text/css");
				style.setAttribute("media", "screen");

				document.getElementsByTagName('head')[0].appendChild(style);
				if (!window.createPopup) { /* For Safari */
					style.appendChild(document.createTextNode(''));
				}

				styleSheet = style.sheet;
			}

			return styleSheet;
		},

		//removes an animation rule from a sheet
		removeAnimation = function (sheet, name) {
			for (var j = sheet.cssRules.length - 1; j >= 0; j--) {
				var rule = sheet.cssRules[j];
				// 7 means the keyframe rule
				if (rule.type === 7 && rule.name == name) {
					sheet.deleteRule(j)
					return;
				}
			}
		},

		// Returns whether the animation should be passed to the original $.fn.animate.
		passThrough = function (props, ops) {
			var nonElement = !(this[0] && this[0].nodeType),
				isInline = !nonElement && $(this).css("display") === "inline" && $(this).css("float") === "none";

			for (var name in props) {
				if (props[name] == 'show' || props[name] == 'hide' // jQuery does something with these two values
					|| $.isArray(props[name]) // Arrays for individual easing
					|| props[name] < 0 // Negative values not handled the same
					|| name == 'zIndex' || name == 'z-index'
					) {  // unit-less value
					return true;
				}
			}

			return props.jquery === true || browser === null ||
				// Animating empty properties
				$.isEmptyObject(props) ||
				// Second parameter is an object - we can only handle primitives
				$.isPlainObject(ops) ||
				// Second parameter is a string like 'slow' TODO: remove
				typeof ops == 'string' ||
				// Inline and non elements
				isInline || nonElement;
		},

		// Gets a CSS number (with px added as the default unit if the value is a number)
		cssValue = function(origName, value) {
			if (typeof value === "number" && !$.cssNumber[ origName ]) {
				return value += "px";
			}
			return value;
		},

		// Feature detection borrowed by http://modernizr.com/
		getBrowser = function(){
			if(!browser) {
				var t,
					el = document.createElement('fakeelement'),
					transitions = {
						'transition': {
							transitionEnd : 'transitionEnd',
							prefix : ''
						},
	//					'OTransition': {
	//						transitionEnd : 'oAnimationEnd',
	//						prefix : '-o-'
	//					},
	//					'MSTransition': {
	//						transitionEnd : 'msTransitionEnd',
	//						prefix : '-ms-'
	//					},
						'MozTransition': {
							transitionEnd : 'animationend',
							prefix : '-moz-'
						},
						'WebkitTransition': {
							transitionEnd : 'webkitAnimationEnd',
							prefix : '-webkit-'
						}
					}

				for(t in transitions){
					if( el.style[t] !== undefined ){
						browser = transitions[t];
					}
				}
			}
			return browser;
		},

		// Properties that Firefox can't animate if set to 'auto':
		// https://bugzilla.mozilla.org/show_bug.cgi?id=571344
		// Provides a converter that returns the actual value
		ffProps = {
			top : function(el) {
				return el.position().top;
			},
			left : function(el) {
				return el.position().left;
			},
			width : function(el) {
				return el.width();
			},
			height : function(el) {
				return el.height();
			},
			fontSize : function(el) {
				return '1em';
			}
		},

		// Add browser specific prefix
		addPrefix = function(properties) {
			var result = {};
			$.each(properties, function(name, value) {
				result[browser.prefix + name] = value;
			});
			return result;
		},

		// Returns the animation name for a given style. It either uses a cached
		// version or adds it to the stylesheet, removing the oldest style if the
		// cache has reached a certain size.
		getAnimation = function(style) {
			var sheet, name, last;

			// Look up the cached style, set it to that name and reset age if found
			// increment the age for any other animation
			$.each(cache, function(i, animation) {
				if(style === animation.style) {
					name = animation.name;
					animation.age = 0;
				} else {
					animation.age += 1;
				}
			});

			if(!name) { // Add a new style
				sheet = getStyleSheet();
				name = "jquerypp_animation_" + (animationNum++);
				// get the last sheet and insert this rule into it
				sheet.insertRule("@" + browser.prefix + "keyframes " + name + ' ' + style,
					(sheet.cssRules && sheet.cssRules.length) || 0);
				cache.push({
					name : name,
					style : style,
					age : 0
				});

				// Sort the cache by age
				cache.sort(function(first, second) {
					return first.age - second.age;
				});

				// Remove the last (oldest) item from the cache if it has more than 20 items
				if(cache.length > 20) {
					last = cache.pop();
					removeAnimation(sheet, last.name);
				}
			}

			return name;
		};

	/**
	 * @function $.fn.animate
	 * @parent $.animate
	 *
	 * Animate CSS properties using native CSS animations, if possible.
	 * Uses the original [$.fn.animate()](http://api.$.com/animate/) otherwise.
	 *
	 * @param {Object} props The CSS properties to animate
	 * @param {Integer|String|Object} [speed=400] The animation duration in ms.
	 * Will use $.fn.animate if a string or object is passed
	 * @param {Function} [callback] A callback to execute once the animation is complete
	 * @return {jQuery} The jQuery element
	 */
	$.fn.animate = function (props, speed, callback) {
		//default to normal animations if browser doesn't support them
		if (passThrough.apply(this, arguments)) {
			return oldanimate.apply(this, arguments);
		}
		if ($.isFunction(speed)) {
			callback = speed;
		}

		// Add everything to the animation queue
		this.queue('fx', function(done) {
			var
				//current CSS values
				current,
				// The list of properties passed
				properties = [],
				to = "",
				prop,
				self = $(this),
				duration = $.fx.speeds[speed] || speed || $.fx.speeds._default,
				//the animation keyframe name
				animationName,
				// The key used to store the animation hook
				dataKey,
				//the text for the keyframe
				style = "{ from {",
				// The animation end event handler.
				// Will be called both on animation end and after calling .stop()
				animationEnd = function (currentCSS, exec) {
					self.css(currentCSS);
					
					self.css(addPrefix({
						"animation-duration" : "",
						"animation-name" : "",
						"animation-fill-mode" : ""
					}));

					if (callback && exec) {
						// Call success, pass the DOM element as the this reference
						callback.call(self[0], true)
					}

					$.removeData(self, dataKey, true);
				}

			for(prop in props) {
				properties.push(prop);
			}

			if(browser.prefix === '-moz-') {
				// Normalize 'auto' properties in FF
				$.each(properties, function(i, prop) {
					var converter = ffProps[$.camelCase(prop)];
					if(converter && self.css(prop) == 'auto') {
						self.css(prop, converter(self));
					}
				});
			}

			// Use $.styles
			current = self.styles.apply(self, properties);
			$.each(properties, function(i, cur) {
				// Convert a camelcased property name
				var name = cur.replace(/([A-Z]|^ms)/g, "-$1" ).toLowerCase();
				style += name + " : " + cssValue(cur, current[cur]) + "; ";
				to += name + " : " + cssValue(cur, props[cur]) + "; ";
			});

			style += "} to {" + to + " }}";

			animationName = getAnimation(style);
			dataKey = animationName + '.run';

			// Add a hook which will be called when the animation stops
			$._data(this, dataKey, {
				stop : function(gotoEnd) {
					// Pause the animation
					self.css(addPrefix({
						'animation-play-state' : 'paused'
					}));
					// Unbind the animation end handler
					self.off(browser.transitionEnd, animationEnd);
					if(!gotoEnd) {
						// We were told not to finish the animation
						// Call animationEnd but set the CSS to the current computed style
						animationEnd(self.styles.apply(self, properties), false);
					} else {
						// Finish animaion
						animationEnd(props, true);
					}
				}
			});

			// set this element to point to that animation
			self.css(addPrefix({
				"animation-duration" : duration + "ms",
				"animation-name" : animationName,
				"animation-fill-mode": "forwards"
			}));

			// Attach the transition end event handler to run only once
			self.one(browser.transitionEnd, function() {
				// Call animationEnd using the passed properties
				animationEnd(props, true);
				done();
			});

		});

		return this;
	};
})(jQuery);
(function($){

/**
 * @function jQuery.fn.compare
 * @parent jQuery.compare
 *
 * Compare two elements and return a bitmask as a number representing the following conditions:
 *
 * - `000000` -> __0__: Elements are identical
 * - `000001` -> __1__: The nodes are in different documents (or one is outside of a document)
 * - `000010` -> __2__: #bar precedes #foo
 * - `000100` -> __4__: #foo precedes #bar
 * - `001000` -> __8__: #bar contains #foo
 * - `010000` -> __16__: #foo contains #bar
 *
 * You can check for any of these conditions using a bitwise AND:
 *
 *     if( $('#foo').compare($('#bar')) & 2 ) {
 *       console.log("#bar precedes #foo")
 *     }
 *
 * @param {HTMLElement|jQuery} element an element or jQuery collection to compare against.
 * @return {Number} A number representing a bitmask deatiling how the elements are positioned from each other.
 */

// See http://ejohn.org/blog/comparing-document-position/
jQuery.fn.compare = function(element){ //usually 
	try{
		// Firefox 3 throws an error with XUL - we can't use compare then
		element = element.jquery ? element[0] : element;
	}catch(e){
		return null;
	}

	// make sure we aren't coming from XUL element
	if (window.HTMLElement) {
		var s = HTMLElement.prototype.toString.call(element)
		if (s == '[xpconnect wrapped native prototype]' || s == '[object XULElement]' || s === '[object Window]') {
			return null;
		}
	}

	if(this[0].compareDocumentPosition){
		// For browsers that support it, use compareDocumentPosition
		// https://developer.mozilla.org/en/DOM/Node.compareDocumentPosition
		return this[0].compareDocumentPosition(element);
	}

	// this[0] contains element
	if(this[0] == document && element != document) return 8;

	var number =
			// this[0] contains element
			(this[0] !== element && this[0].contains(element) && 16) +
			// element contains this[0]
			(this[0] != element && element.contains(this[0]) && 8),
		docEl = document.documentElement;

	// Use the sourceIndex
	if(this[0].sourceIndex){
		// this[0] precedes element
		number += (this[0].sourceIndex < element.sourceIndex && 4)
		// element precedes foo[0]
		number += (this[0].sourceIndex > element.sourceIndex && 2)
		// The nodes are in different documents
		number += (this[0].ownerDocument !== element.ownerDocument ||
			(this[0] != docEl && this[0].sourceIndex <= 0 ) ||
			(element != docEl && element.sourceIndex <= 0 )) && 1
	}

	return number;
}

})(jQuery);
(function($){
    /**
     * @page jQuery.toJSON jQuery.toJSON
     * @parent jquerymx.lang
     * 
     *     jQuery.toJSON( json-serializble )
     * 
     * Converts the given argument into a JSON respresentation.
     * 
     * If an object has a "toJSON" function, that will 
     * be used to get the representation.
     * Non-integer/string keys are skipped in the 
     * object, as are keys that point to a function.
     * 
     * json-serializble:
     * The *thing* to be converted.
     */
    $.toJSON = function(o, replacer, space, recurse)
    {
        if (typeof(JSON) == 'object' && JSON.stringify)
            return JSON.stringify(o, replacer, space);

        if (!recurse && $.isFunction(replacer))
            o = replacer("", o);

        if (typeof space == "number")
            space = "          ".substring(0, space);
        space = (typeof space == "string") ? space.substring(0, 10) : "";
        
        var type = typeof(o);
    
        if (o === null)
            return "null";
    
        if (type == "undefined" || type == "function")
            return undefined;
        
        if (type == "number" || type == "boolean")
            return o + "";
    
        if (type == "string")
            return $.quoteString(o);
    
        if (type == 'object')
        {
            if (typeof o.toJSON == "function") 
                return $.toJSON( o.toJSON(), replacer, space, true );
            
            if (o.constructor === Date)
            {
                var month = o.getUTCMonth() + 1;
                if (month < 10) month = '0' + month;

                var day = o.getUTCDate();
                if (day < 10) day = '0' + day;

                var year = o.getUTCFullYear();
                
                var hours = o.getUTCHours();
                if (hours < 10) hours = '0' + hours;
                
                var minutes = o.getUTCMinutes();
                if (minutes < 10) minutes = '0' + minutes;
                
                var seconds = o.getUTCSeconds();
                if (seconds < 10) seconds = '0' + seconds;
                
                var milli = o.getUTCMilliseconds();
                if (milli < 100) milli = '0' + milli;
                if (milli < 10) milli = '0' + milli;

                return '"' + year + '-' + month + '-' + day + 'T' +
                             hours + ':' + minutes + ':' + seconds + 
                             '.' + milli + 'Z"'; 
            }

            var process = ($.isFunction(replacer)) ?
                function (k, v) { return replacer(k, v); } :
                function (k, v) { return v; },
                nl = (space) ? "\n" : "",
                sp = (space) ? " " : "";

            if (o.constructor === Array) 
            {
                var ret = [];
                for (var i = 0; i < o.length; i++)
                    ret.push(( $.toJSON( process(i, o[i]), replacer, space, true ) || "null" ).replace(/^/gm, space));

                return "[" + nl + ret.join("," + nl) + nl + "]";
            }
        
            var pairs = [], proplist;
            if ($.isArray(replacer)) {
                proplist = $.map(replacer, function (v) {
                    return (typeof v == "string" || typeof v == "number") ?
                        v + "" :
                        null;
                });
            }
            for (var k in o) {
                var name, val, type = typeof k;

                if (proplist && $.inArray(k + "", proplist) == -1)
                    continue;

                if (type == "number")
                    name = '"' + k + '"';
                else if (type == "string")
                    name = $.quoteString(k);
                else
                    continue;  //skip non-string or number keys
            
                val = $.toJSON( process(k, o[k]), replacer, space, true );
            
                if (typeof val == "undefined")
                    continue;  //skip pairs where the value is a function.
            
                pairs.push((name + ":" + sp + val).replace(/^/gm, space));
            }

            return "{" + nl + pairs.join("," + nl) + nl + "}";
        }
    };

    /** 
     * @function jQuery.evalJSON
     * Evaluates a given piece of json source.
     **/
    $.evalJSON = function(src)
    {
        if (typeof(JSON) == 'object' && JSON.parse)
            return JSON.parse(src);
        return eval("(" + src + ")");
    };
    
    /** 
     * @function jQuery.secureEvalJSON
     * Evals JSON in a way that is *more* secure.
     **/
    $.secureEvalJSON = function(src)
    {
        if (typeof(JSON) == 'object' && JSON.parse)
            return JSON.parse(src);
        
        var filtered = src;
        filtered = filtered.replace(/\\["\\\/bfnrtu]/g, '@');
        filtered = filtered.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
        filtered = filtered.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
        
        if (/^[\],:{}\s]*$/.test(filtered))
            return eval("(" + src + ")");
        else
            throw new SyntaxError("Error parsing JSON, source is not valid.");
    };

    /** 
     * @function jQuery.quoteString
     * 
     * Returns a string-repr of a string, escaping quotes intelligently.  
     * Mostly a support function for toJSON.
     * 
     * Examples:
     * 
     *      jQuery.quoteString("apple") //-> "apple"
     * 
     *      jQuery.quoteString('"Where are we going?", she asked.')
     *        // -> "\"Where are we going?\", she asked."
     **/
    $.quoteString = function(string)
    {
        if (string.match(_escapeable))
        {
            return '"' + string.replace(_escapeable, function (a) 
            {
                var c = _meta[a];
                if (typeof c === 'string') return c;
                c = a.charCodeAt();
                return '\\u00' + Math.floor(c / 16).toString(16) + (c % 16).toString(16);
            }) + '"';
        }
        return '"' + string + '"';
    };
    
    var _escapeable = /["\\\x00-\x1f\x7f-\x9f]/g;
    
    var _meta = {
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    };
})(jQuery);
(function() {
    // break
    /**
     * @function jQuery.cookie
     * @parent jquerypp
     * @plugin jquery/dom/cookie
     * @author Klaus Hartl/klaus.hartl@stilbuero.de
     *
     * `jQuery.cookie(name, [value], [options])` lets you create, read and remove cookies. It is the
     * [jQuery cookie plugin](https://github.com/carhartl/jquery-cookie) written by [Klaus Hartl](stilbuero.de)
     * and dual licensed under the [MIT](http://www.opensource.org/licenses/mit-license.php)
     * and [GPL](http://www.gnu.org/licenses/gpl.html) licenses.
     *
	 * ## Examples
	 * 
	 * Set the value of a cookie.
	 *  
	 *      $.cookie('the_cookie', 'the_value');
	 * 
	 * Create a cookie with all available options.
	 *
     *      $.cookie('the_cookie', 'the_value', {
     *          expires: 7,
     *          path: '/',
     *          domain: 'jquery.com',
     *          secure: true
     *      });
	 *
	 * Create a session cookie.
	 *
     *      $.cookie('the_cookie', 'the_value');
	 *
	 * Delete a cookie by passing null as value. Keep in mind that you have to use the same path and domain
	 * used when the cookie was set.
	 *
     *      $.cookie('the_cookie', null);
	 *
	 * Get the value of a cookie.
     *
	 *      $.cookie('the_cookie');
     *
     * @param {String} [name] The name of the cookie.
     * @param {String} [value] The value of the cookie.
     * @param {Object} [options] An object literal containing key/value pairs to provide optional cookie attributes. Values can be:
     *
     * - `expires` - Either an integer specifying the expiration date from now on in days or a Date object. If a negative value is specified (e.g. a date in the past), the cookie will be deleted. If set to null or omitted, the cookie will be a session cookie and will not be retained when the the browser exits.
     * - `domain` - The domain name
     * - `path` - The value of the path atribute of the cookie (default: path of page that created the cookie).
     * - `secure` - If true, the secure attribute of the cookie will be set and the cookie transmission will require a secure protocol (like HTTPS).
     *
     * @return {String} the value of the cookie or {undefined} when setting the cookie.
     */
    jQuery.cookie = function(name, value, options) {
        if (typeof value != 'undefined') {
            // name and value given, set cookie
            options = options ||
            {};
            if (value === null) {
                value = '';
                options.expires = -1;
            }
	        // convert value to JSON string
            if (typeof value == 'object' && jQuery.toJSON) {
                value = jQuery.toJSON(value);
            }
            var expires = '';
	        // Set expiry
            if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
                var date;
                if (typeof options.expires == 'number') {
                    date = new Date();
                    date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
                }
                else {
                    date = options.expires;
                }
                expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
            }
            // CAUTION: Needed to parenthesize options.path and options.domain
            // in the following expressions, otherwise they evaluate to undefined
            // in the packed version for some reason...
            var path = options.path ? '; path=' + (options.path) : '';
            var domain = options.domain ? '; domain=' + (options.domain) : '';
            var secure = options.secure ? '; secure' : '';
	        // Set the cookie name=value;expires=;path=;domain=;secure-
            document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
        }
        else { // only name given, get cookie
            var cookieValue = null;
            if (document.cookie && document.cookie != '') {
                var cookies = document.cookie.split(';');
                for (var i = 0; i < cookies.length; i++) {
                    var cookie = jQuery.trim(cookies[i]);
                    // Does this cookie string begin with the name we want?
                    if (cookie.substring(0, name.length + 1) == (name + '=')) {
	                    // Get the cookie value
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
	        // Parse JSON from the cookie into an object
            if (jQuery.evalJSON && cookieValue && cookieValue.match(/^\s*\{/)) {
                try {
                    cookieValue = jQuery.evalJSON(cookieValue);
                }
                catch (e) {
                }
            }
            return cookieValue;
        }
    };

})(jQuery);
(function($) {

var
	//margin is inside border
	weird = /button|select/i,
	getBoxes = {},
    checks = {
        width: ["Left", "Right"],
        height: ['Top', 'Bottom'],
        oldOuterHeight: $.fn.outerHeight,
        oldOuterWidth: $.fn.outerWidth,
        oldInnerWidth: $.fn.innerWidth,
        oldInnerHeight: $.fn.innerHeight
    };

$.each({ 

/**
 * @function jQuery.fn.outerWidth
 * @parent jQuery.dimensions
 *
 * `jQuery.fn.outerWidth([value], [includeMargins])` lets you set
 * the outer width of an object where:
 *
 *      outerWidth = width + padding + border + (margin)
 *
 * And can be used like:
 *
 *      $("#foo").outerWidth(100); //sets outer width
 *      $("#foo").outerWidth(100, true); // uses margins
 *      $("#foo").outerWidth(); //returns outer width
 *      $("#foo").outerWidth(true); //returns outer width + margins
 *
 * When setting the outerWidth, it adjusts the width of the element.
 * If *includeMargin* is set to `true` margins will also be included.
 * It is also possible to animate the outer width:
 * 
 *      $('#foo').animate({ outerWidth: 200 });
 *
 * @param {Number} [width] The width to set
 * @param {Boolean} [includeMargin=false] Makes setting the outerWidth adjust
 * for margins.
 * @return {jQuery|Number} Returns the outer width or the jQuery wrapped elements
 * if you are setting the outer width.
 */
width: 
/**
 * @function jQuery.fn.innerWidth
 * @parent jQuery.dimensions
 *
 * `jQuery.fn.innerWidth([value])` lets you set the inner width of an element where
 * 
 *      innerWidth = width + padding
 *      
 * Use it like:
 *
 *      $("#foo").innerWidth(100); //sets inner width
 *      $("#foo").outerWidth(); // returns inner width
 *      
 * Or in an animation like:
 * 
 *      $('#foo').animate({ innerWidth : 200 });
 *
 * Setting inner width adjusts the width of the element.
 *
 * @param {Number} [width] The inner width to set
 * @return {jQuery|Number} Returns the inner width or the jQuery wrapped elements
 * if you are setting the inner width.
 */
"Width", 
/**
 * @function jQuery.fn.outerHeight
 * @parent jQuery.dimensions
 *
 * `jQuery.fn.outerHeight([value], [includeMargins])` lets
 * you set the outer height of an object where:
 *
 *      outerHeight = height + padding + border + (margin)
 *
 * And can be used like:
 *
 *      $("#foo").outerHeight(100); //sets outer height
 *      $("#foo").outerHeight(100, true); // uses margins
 *      $("#foo").outerHeight(); //returns outer height
 *      $("#foo").outerHeight(true); //returns outer height + margins
 *
 * When setting the outerHeight, it adjusts the height of the element.
 * If *includeMargin* is set to `true` margins will also be included.
 * It is also possible to animate the outer heihgt:
 *
 *      $('#foo').animate({ outerHeight : 200 });
 *
 * @param {Number} [height] The height to set
 * @param {Boolean} [includeMargin=false] Makes setting the outerHeight adjust
 * for margins.
 * @return {jQuery|Number} Returns the outer height or the jQuery wrapped elements
 * if you are setting the outer height.
 */
height: 
/**
 * @function jQuery.fn.innerHeight
 * @parent jQuery.dimensions
 *
 * `jQuery.fn.innerHeight([value])` lets you set the inner height of an element where
 *
 *      innerHeight = height + padding
 *
 * Use it like:
 *
 *      $("#foo").innerHeight(100); //sets inner height
 *      $("#foo").outerHeight(); // returns inner height
 *
 * Or in an animation like:
 *
 *      $('#foo').animate({ innerHeight : 200 });
 *
 * Setting inner height adjusts the height of the element.
 *
 * @param {Number} [height] The inner height to set
 * @return {jQuery|Number} Returns the inner height or the jQuery wrapped elements
 * if you are setting the inner height.
 */
// for each 'height' and 'width'
"Height" }, function(lower, Upper) {

    //used to get the padding and border for an element in a given direction
    getBoxes[lower] = function(el, boxes) {
        var val = 0;
        if (!weird.test(el.nodeName)) {
            //make what to check for ....
            var myChecks = [];
            $.each(checks[lower], function() {
                var direction = this;
                $.each(boxes, function(name, val) {
                    if (val)
                        myChecks.push(name + direction+ (name == 'border' ? "Width" : "") );
                })
            })
            $.each($.styles(el, myChecks), function(name, value) {
                val += (parseFloat(value) || 0);
            })
        }
        return val;
    }

    //getter / setter
    $.fn["outer" + Upper] = function(v, margin) {
        var first = this[0];
		if (typeof v == 'number') {
			// Setting the value
            first && this[lower](v - getBoxes[lower](first, {padding: true, border: true, margin: margin}))
            return this;
        } else {
			// Return the old value
            return first ? checks["oldOuter" + Upper].call(this, v) : null;
        }
    }
    $.fn["inner" + Upper] = function(v) {
        var first = this[0];
		if (typeof v == 'number') {
			// Setting the value
            first&& this[lower](v - getBoxes[lower](first, { padding: true }))
            return this;
        } else {
			// Return the old value
            return first ? checks["oldInner" + Upper].call(this, v) : null;
        }
    }
    //provides animations
	var animate = function(boxes){
		// Return the animation function
		return function(fx){
			if (fx.state == 0) {
	            fx.start = $(fx.elem)[lower]();
	            fx.end = fx.end - getBoxes[lower](fx.elem,boxes);
	        }
	        fx.elem.style[lower] = (fx.pos * (fx.end - fx.start) + fx.start) + "px"
		}
	}
    $.fx.step["outer" + Upper] = animate({padding: true, border: true})
	$.fx.step["outer" + Upper+"Margin"] =  animate({padding: true, border: true, margin: true})
	$.fx.step["inner" + Upper] = animate({padding: true})

})

})(jQuery);
(function( $ ) {
	var
		// use to parse bracket notation like my[name][attribute]
		keyBreaker = /[^\[\]]+/g,
		// converts values that look like numbers and booleans and removes empty strings
		convertValue = function( value ) {
			if ( $.isNumeric( value )) {
				return parseFloat( value );
			} else if ( value === 'true') {
				return true;
			} else if ( value === 'false' ) {
				return false;
			} else if ( value === '' ) {
				return undefined;
			}
			return value;
		}, 
		nestData = function( elem, type, data, parts, value, seen ) {
			var name = parts.shift();

			if ( parts.length ) {
				if ( ! data[ name ] ) {
					data[ name ] = {};
				}
				// Recursive call
				nestData( elem, type, data[ name ], parts, value, seen );
			} else {

				// Handle same name case, as well as "last checkbox checked"
				// case
				if ( name in seen && type != "radio" && ! $.isArray( data[ name ] )) {
					if ( name in data ) {
						data[ name ] = [ data[name] ];
					} else {
						data[ name ] = [];
					}
				} else {
					seen[ name ] = true;
				}

				// Finally, assign data
				if ( ( type == "radio" || type == "checkbox" ) && ! elem.is(":checked") ) {
					return
				}

				if ( ! data[ name ] ) {
					data[ name ] = value;
				} else {
					data[ name ].push( value );
				}
				

			}

		};

	/**
	 * @function jQuery.fn.formParams
	 * @parent jQuery.formParams
	 * @plugin jquery/dom/form_params
	 * @test jquery/dom/form_params/qunit.html
	 *
	 * Returns a JavaScript object for values in a form.
	 * It creates nested objects by using bracket notation in the form element name.
	 *
	 * @param {Object} [params] If an object is passed, the form will be repopulated
	 * with the values of the object based on the name of the inputs within
	 * the form
	 * @param {Boolean} [convert=false] True if strings that look like numbers
	 * and booleans should be converted and if empty string should not be added
	 * to the result.
	 * @return {Object} An object of name-value pairs.
	 */
	$.fn.extend({
		formParams: function( params ) {

			var convert;

			// Quick way to determine if something is a boolean
			if ( !! params === params ) {
				convert = params;
				params = null;
			}

			if ( params ) {
				return this.setParams( params );
			} else {
				return this.getParams( convert );
			}
		},
		setParams: function( params ) {

			// Find all the inputs
			this.find("[name]").each(function() {
				
				var value = params[ $(this).attr("name") ],
					$this;
				
				// Don't do all this work if there's no value
				if ( value !== undefined ) {
					$this = $(this);
					
					// Nested these if statements for performance
					if ( $this.is(":radio") ) {
						if ( $this.val() == value ) {
							$this.attr("checked", true);
						}
					} else if ( $this.is(":checkbox") ) {
						// Convert single value to an array to reduce
						// complexity
						value = $.isArray( value ) ? value : [value];
						if ( $.inArray( $this.val(), value ) > -1) {
							$this.attr("checked", true);
						}
					} else {
						$this.val( value );
					}
				}
			});
		},
		getParams: function( convert ) {
			var data = {},
				// This is used to keep track of the checkbox names that we've
				// already seen, so we know that we should return an array if
				// we see it multiple times. Fixes last checkbox checked bug.
				seen = {},
				current;


			this.find("[name]").each(function() {
				var $this    = $(this),
					type     = $this.attr("type"),
					name     = $this.attr("name"),
					value    = $this.val(),
					parts;

				// Don't accumulate submit buttons and nameless elements
				if ( type == "submit" || ! name ) {
					return;
				}

				// Figure out name parts
				parts = name.match( keyBreaker );
				if ( ! parts.length ) {
					parts = [name];
				}

				// Convert the value
				if ( convert ) {
					value = convertValue( value );
				}

				// Assign data recursively
				nestData( $this, type, data, parts, value, seen );

			});

			return data;
		}
	});

})(jQuery);
(function($){
// TODOS ...
// Ad

$.fn.range =
/**
 * @function jQuery.fn.range
 * @parent jQuery.Range
 *
 * `$.fn.range` returns a new [jQuery.Range] instance for the first selected element.
 *
 *     $('#content').range() //-> range
 *
 * @return {$.Range} A $.Range instance for the selected element
 */
function(){
	return $.Range(this[0])
}

var convertType = function(type){
	return  type.replace(/([a-z])([a-z]+)/gi, function(all,first,  next){
			  return first+next.toLowerCase()	
			}).replace(/_/g,"");
},
reverse = function(type){
	return type.replace(/^([a-z]+)_TO_([a-z]+)/i, function(all, first, last){
		return last+"_TO_"+first;
	});
},
getWindow = function( element ) {
	return element ? element.ownerDocument.defaultView || element.ownerDocument.parentWindow : window
},
bisect = function(el, start, end){
	//split the start and end ... figure out who is touching ...
	if(end-start == 1){
		return 
	}
},
support = {};
/**
 * @Class jQuery.Range
 * @parent jQuery.Range
 *
 * Depending on the object passed, the selected text will be different.
 * 
 * @param {TextRange|HTMLElement|Point} [range] An object specifiying a 
 * range.  Depending on the object, the selected text will be different.  $.Range supports the
 * following types 
 * 
 *   - __undefined or null__ - returns a range with nothing selected
 *   - __HTMLElement__ - returns a range with the node's text selected
 *   - __Point__ - returns a range at the point on the screen.  The point can be specified like:
 *         
 *         //client coordinates
 *         {clientX: 200, clientY: 300}
 *         
 *         //page coordinates
 *         {pageX: 200, pageY: 300} 
 *         {top: 200, left: 300}
 *         
 *   - __TextRange__ a raw text range object.
 */
$.Range = function(range){
	// If it's called w/o new, call it with new!
	if(this.constructor !== $.Range){
		return new $.Range(range);
	}
	// If we are passed a jQuery-wrapped element, get the raw element
	if(range && range.jquery){
		range = range[0];
	}
	// If we have an element, or nothing
	if(!range || range.nodeType){
		// create a range
		this.win = getWindow(range)
		if(this.win.document.createRange){
			this.range = this.win.document.createRange()
		}else{
			this.range = this.win.document.body.createTextRange()
		}
		// if we have an element, make the range select it
		if(range){
			this.select(range)
		}
	} 
	// if we are given a point
	else if (range.clientX != null || range.pageX != null || range.left != null) {
		this.moveToPoint(range);
	} 
	// if we are given a touch event
	else if (range.originalEvent && range.originalEvent.touches && range.originalEvent.touches.length) {
		this.moveToPoint(range.originalEvent.touches[0])
	
	} 
	// if we are a normal event
	else if (range.originalEvent && range.originalEvent.changedTouches && range.originalEvent.changedTouches.length) {
		this.moveToPoint(range.originalEvent.changedTouches[0])
	} 
	// given a TextRange or something else?
	else {
		this.range = range;
	} 
};
/**
 * @static
 */
$.Range.
/**
 * `$.Range.current([element])` returns the currently selected range
 * (using [window.getSelection](https://developer.mozilla.org/en/nsISelection)).
 * 
 *     var range = $.Range.current()
 *     range.start().offset // -> selection start offset
 *     range.end().offset // -> selection end offset
 * 
 * @param {HTMLElement} [el] an optional element used to get selection for a given window.
 * @return {jQuery.Range} The range instance.
 */
current = function(el){
	var win = getWindow(el),
		selection;
	if(win.getSelection){
		selection = win.getSelection()
		return new $.Range( selection.rangeCount ? selection.getRangeAt(0) : win.document.createRange())
	}else{
		return  new $.Range( win.document.selection.createRange() );
	}
};




$.extend($.Range.prototype,
/** @prototype **/
{
	/**
	 * `range.moveToPoint(point)` moves the range end and start position to a specific point.
	 * A point can be specified like:
	 *
	 *      //client coordinates
	 *      {clientX: 200, clientY: 300}
	 *
	 *      //page coordinates
	 *      {pageX: 200, pageY: 300}
	 *      {top: 200, left: 300}
	 *
	 * @param point The point to move the range to
	 * @return {$.Range}
	 */
	moveToPoint : function(point){
		var clientX = point.clientX, clientY = point.clientY
		if(!clientX){
			var off = scrollOffset();
			clientX = (point.pageX || point.left || 0 ) - off.left;
			clientY = (point.pageY || point.top || 0 ) - off.top;
		}
		if(support.moveToPoint){
			this.range = $.Range().range
			this.range.moveToPoint(clientX, clientY);
			return this;
		}
		
		
		// it's some text node in this range ...
		var parent = document.elementFromPoint(clientX, clientY);
		
		//typically it will be 'on' text
		for(var n=0; n < parent.childNodes.length; n++){
			var node = parent.childNodes[n];
			if(node.nodeType === 3 || node.nodeType === 4){
				var range = $.Range(node),
					length = range.toString().length;
				
				
				// now lets start moving the end until the boundingRect is within our range
				
				for(var i = 1; i < length+1; i++){
					var rect = range.end(i).rect();
					if(rect.left <= clientX && rect.left+rect.width >= clientX &&
					  rect.top <= clientY && rect.top+rect.height >= clientY ){
						range.start(i-1); 
						this.range = range.range;
						return; 	
					}
				}
			}
		}
		
		// if not 'on' text, recursively go through and find out when we shift to next
		// 'line'
		var previous;
		iterate(parent.childNodes, function(textNode){
			var range = $.Range(textNode);
			if(range.rect().top > point.clientY){
				return false;
			}else{
				previous = range;
			}
		});
		if(previous){
			previous.start(previous.toString().length);
			this.range = previous.range;
		}else{
			this.range = $.Range(parent).range
		}
		
	},
	
	window : function(){
		return this.win || window;
	},
	/**
	 * `range.overlaps([elRange])` returns `true` if any portion of these two ranges overlap.
	 *
	 *     var foo = document.getElementById('foo');
	 *
	 *     $.Range(foo.childNodes[0]).overlaps(foo.childNodes[1]) //-> false
	 * 
	 * @param {jQuery.Range} elRange The range to compare
	 * @return {Boolean} true if part of the ranges overlap, false if otherwise.
	 */
	overlaps : function(elRange){
		if(elRange.nodeType){
			elRange = $.Range(elRange).select(elRange);
		}
		//if the start is within the element ...
		var startToStart = this.compare("START_TO_START", elRange),
			endToEnd = this.compare("END_TO_END", elRange)
		
		// if we wrap elRange
		if(startToStart <=0 && endToEnd >=0){
			return true;
		}
		// if our start is inside of it
		if( startToStart >= 0 &&
			this.compare("START_TO_END", elRange) <= 0 )	{
			return true;
		}
		// if our end is inside of elRange
		if(this.compare("END_TO_START", elRange) >= 0 &&
			endToEnd <= 0 )	{
			return true;
		}
		return false;
	},
	/**
	 * `range.collapse([toStart])` collapses a range to one of its boundary points.
	 * See [range.collapse](https://developer.mozilla.org/en/DOM/range.collapse).
	 * 
	 *     $('#foo').range().collapse()
	 * 
	 * @param {Boolean} [toStart] true if to the start of the range, false if to the
	 *  end.  Defaults to false.
	 * @return {jQuery.Range} returns the range for chaining.
	 */
	collapse : function(toStart){
		this.range.collapse(toStart === undefined ? true : toStart);
		return this;
	},
	/**
	 * `range.toString()` returns the text of the range.
	 * 
	 *     currentText = $.Range.current().toString()
	 * 
	 * @return {String} The text content of this range
	 */
	toString : function(){
		return typeof this.range.text == "string"  ? this.range.text : this.range.toString();
	},
	/**
	 * `range.start([start])` gets or sets the start of the range.
	 *
	 * If a value is not provided, start returns the range's starting container and offset like:
	 *
	 *     $('#foo').range().start()
	 *     //-> {container: fooElement, offset: 0 }
	 *
	 * If a set value is provided, it can set the range.  The start of the range is set differently
	 * depending on the type of set value:
	 *
	 *   - __Object__ - an object with the new starting container and offset like
	 *
	 *         $.Range().start({container:  $('#foo')[0], offset: 20})
	 *
	 *   - __Number__ - the new offset value.  The container is kept the same.
	 *
	 *   - __String__ - adjusts the offset by converting the string offset to a number and adding it to the current
	 *     offset.  For example, the following moves the offset forward four characters:
	 *
	 *         $('#foo').range().start("+4")
	 *
	 * Note that `start` can return a text node. To get the containing element use this:
	 *
	 *     var startNode = range.start().container;
	 *     if( startNode.nodeType === Node.TEXT_NODE ||
	 *      startNode.nodeType === Node.CDATA_SECTION_NODE ) {
	 *          startNode = startNode.parentNode;
	 *     }
	 *     $(startNode).addClass('highlight');
	 *
	 * @param {Object|String|Number} [set] a set value if setting the start of the range or nothing if reading it.
	 * @return {jQuery.Range|Object} if setting the start, the range is returned for chaining, otherwise, the
	 *   start offset and container are returned.
	 */
	start : function(set){
		if(set === undefined){
			if(this.range.startContainer){
				return {
					container : this.range.startContainer,
					offset : this.range.startOffset
				}
			}else{
				var start = this.clone().collapse().parent();
				var startRange = $.Range(start).select(start).collapse();
				startRange.move("END_TO_START", this);
				return {
					container : start,
					offset : startRange.toString().length
				}
			}
		} else {
			if (this.range.setStart) {
				if(typeof set == 'number'){
					this.range.setStart(this.range.startContainer, set)
				} else if(typeof set == 'string') {
					var res = callMove(this.range.startContainer, this.range.startOffset, parseInt(set,10))
					this.range.setStart(res.node, res.offset );
				} else {
					this.range.setStart(set.container, set.offset)
				}
			} else {
				if(typeof set == "string"){
					this.range.moveStart('character', parseInt(set,10))
				} else {
					// get the current end container
					var container = this.start().container,
						offset
					if(typeof set == "number") {
						offset = set
					} else {
						container = set.container
						offset = set.offset
					}
					var newPoint = $.Range(container).collapse();
					//move it over offset characters
					newPoint.range.move(offset);
					this.move("START_TO_START",newPoint);
				}
			}
			return this;
		}


	},
	/**
	 * `range.end([end])` gets or sets the end of the range.
	 * It takes similar options as [jQuery.Range::start start]:
	 *
	 * - __Object__ - an object with the new end container and offset like
	 *
	 *         $.Range().end({container:  $('#foo')[0], offset: 20})
	 *
	 * - __Number__ - the new offset value. The container is kept the same.
	 *
	 * - __String__ - adjusts the offset by converting the string offset to a number and adding it to the current
	 * offset. For example, the following moves the offset forward four characters:
	 *
	 *         $('#foo').range().end("+4")
	 *
	 * Note that `end` can return a text node. To get the containing element use this:
	 *
	 *     var startNode = range.end().container;
	 *     if( startNode.nodeType === Node.TEXT_NODE ||
	 *      startNode.nodeType === Node.CDATA_SECTION_NODE ) {
	 *          startNode = startNode.parentNode;
	 *     }
	 *     $(startNode).addClass('highlight');
	 *
	 * @param {Object|String|Number} [set] a set value if setting the end of the range or nothing if reading it.
	 */
	end : function(set){
		if (set === undefined) {
			if (this.range.startContainer) {
				return {
					container: this.range.endContainer,
					offset: this.range.endOffset
				}
			}
			else {
				var end = this.clone().collapse(false).parent(),
					endRange = $.Range(end).select(end).collapse();
				endRange.move("END_TO_END", this);
				return {
					container: end,
					offset: endRange.toString().length
				}
			}
		} else {
			if (this.range.setEnd) {
				if(typeof set == 'number'){
					this.range.setEnd(this.range.endContainer, set)
				} else if(typeof set == 'string') {
					var res = callMove(this.range.endContainer, this.range.endOffset, parseInt(set,10))
					this.range.setEnd(res.node, res.offset );
				} else {
					this.range.setEnd(set.container, set.offset)
				}
			} else {
				if(typeof set == "string"){
					this.range.moveEnd('character', parseInt(set,10));
				} else {
					// get the current end container
					var container = this.end().container,
						offset
					if(typeof set == "number") {
						offset = set
					} else {
						container = set.container
						offset = set.offset
					}
					var newPoint = $.Range(container).collapse();
					//move it over offset characters
					newPoint.range.move(offset);
					this.move("END_TO_START",newPoint);
				}
			}
			return this;
		}
	},
	/**
	 * `range.parent()` returns the most common ancestor element of
	 * the endpoints in the range. This will return a text element if the range is
	 * within a text element. In this case, to get the containing element use this:
	 *
	 *     var parent = range.parent();
	 *     if( parent.nodeType === Node.TEXT_NODE ||
	 *      parent.nodeType === Node.CDATA_SECTION_NODE ) {
	 *          parent = startNode.parentNode;
	 *     }
	 *     $(parent).addClass('highlight');
	 *
	 * @return {HTMLNode} the TextNode or HTMLElement
	 * that fully contains the range
	 */
	parent : function(){
		if(this.range.commonAncestorContainer){
			return this.range.commonAncestorContainer;
		} else {
			
			var parentElement = this.range.parentElement(),
				range = this.range;
			
			// IE's parentElement will always give an element, we want text ranges
			iterate(parentElement.childNodes, function(txtNode){
				if($.Range(txtNode).range.inRange( range ) ){
					// swap out the parentElement
					parentElement = txtNode;
					return false;
				}
			});
			
			return parentElement;
		}	
	},
	/**
	 * `range.rect([from])` returns the bounding rectangle of this range.
	 * 
	 * @param {String} [from] - where the coordinates should be 
	 * positioned from.  By default, coordinates are given from the client viewport.
	 * But if 'page' is given, they are provided relative to the page.
	 * 
	 * @return {TextRectangle} - The client rects.
	 */
	rect : function(from){
		var rect = this.range.getBoundingClientRect();
		// for some reason in webkit this gets a better value
		if(!rect.height && !rect.width){
			rect = this.range.getClientRects()[0]
		}
		if(from === 'page'){
			var off = scrollOffset();
			rect = $.extend({}, rect);
			rect.top += off.top;
			rect.left += off.left;
		}
		return rect;
	},
	/**
	 * `range.rects(from)` returns the client rects.
	 *
	 * @param {String} [from] how the rects coordinates should be given (viewport or page).  Provide 'page' for 
	 * rect coordinates from the page.
	 * @return {Array} The client rects
	 */
	rects : function(from){
		// order rects by size 
		var rects = $.map($.makeArray( this.range.getClientRects() ).sort(function(rect1, rect2){
			return  rect2.width*rect2.height - rect1.width*rect1.height;
		}), function(rect){
			return $.extend({}, rect)
		}),
			i=0,j,
			len = rects.length;
		
		// safari returns overlapping client rects
		// - big rects can contain 2 smaller rects
		// - some rects can contain 0 - width rects
		// - we don't want these 0 width rects
		while(i < rects.length){
			var cur = rects[i],
				found = false;
			
			j = i+1;
			while( j < rects.length ){
				if( withinRect( cur, rects[j] ) ) {
					if(!rects[j].width){
						rects.splice(j,1)
					} else {
						found = rects[j];
						break;
					}
				} else {
					j++;
				}
			}
			
			
			if(found){
				rects.splice(i,1)
			}else{
				i++;
			}
			
		}
		// safari will be return overlapping ranges ...
		if(from == 'page'){
			var off = scrollOffset();
			return $.each(rects, function(ith, item){
				item.top += off.top;
				item.left += off.left;
			})
		}
		
		
		return rects;
	}
	
});
(function(){
	//method branching ....
	var fn = $.Range.prototype,
		range = $.Range().range;
	
	/**
	 * @function compare
	 *
	 * `range.compare(type, compareRange)` compares one range to another range.
	 * 
	 * ## Example
	 * 
	 *     // compare the highlight element's start position
	 *     // to the start of the current range
	 *     $('#highlight')
	 *         .range()
	 *         .compare('START_TO_START', $.Range.current())
	 * 
	 * 
	 *
	 * @param {String} type Specifies the boundary of the
	 * range and the <code>compareRange</code> to compare.
	 * 
	 *   - `"START_TO_START"` - the start of the range and the start of compareRange
	 *   - `"START_TO_END"` - the start of the range and the end of compareRange
	 *   - `"END_TO_END"` - the end of the range and the end of compareRange
	 *   - `"END_TO_START"` - the end of the range and the start of compareRange
	 *   
	 * @param {$.Range} compareRange The other range
	 * to compare against.
	 * @return {Number} a number indicating if the range
	 * boundary is before,
	 * after, or equal to <code>compareRange</code>'s 
	 * boundary where:
	 * 
	 *   - -1 - the range boundary comes before the compareRange boundary
	 *   - 0 - the boundaries are equal
	 *   - 1 - the range boundary comes after the compareRange boundary
	 */
	fn.compare = range.compareBoundaryPoints ? 
		function(type, range){
			return this.range.compareBoundaryPoints(this.window().Range[reverse( type )], range.range)
		}: 
		function(type, range){
			return this.range.compareEndPoints(convertType(type), range.range)
		}
	
	/**
	 * @function move
	 *
	 * `range.move([referenceRange])` moves the endpoints of a range relative to another range.
	 * 
	 *     // Move the current selection's end to the 
	 *     // end of the #highlight element
	 *     $.Range.current().move('END_TO_END',
	 *       $('#highlight').range() )
	 *                            
	 * 
	 * @param {String} type a string indicating the ranges boundary point
	 * to move to which referenceRange boundary point where:
	 * 
	 *   - `"START_TO_START"` - the start of the range moves to the start of referenceRange
	 *   - `"START\_TO\_END"` - the start of the range move to the end of referenceRange
	 *   - `"END_TO_END"` - the end of the range moves to the end of referenceRange
	 *   - `"END_TO_START"` - the end of the range moves to the start of referenceRange
	 *   
	 * @param {jQuery.Range} referenceRange
	 * @return {jQuery.Range} the original range for chaining
	 */
	fn.move = range.setStart ? 
		function(type, range){
	
			var rangesRange = range.range;
			switch(type){
				case "START_TO_END" : 
					this.range.setStart(rangesRange.endContainer, rangesRange.endOffset)
					break;
				case "START_TO_START" : 
					this.range.setStart(rangesRange.startContainer, rangesRange.startOffset)
					break;
				case "END_TO_END" : 
					this.range.setEnd(rangesRange.endContainer, rangesRange.endOffset)
					break;
				case "END_TO_START" : 
					this.range.setEnd(rangesRange.startContainer, rangesRange.startOffset)
					break;
			}
			
			return this;
		}:
		function(type, range){			
			this.range.setEndPoint(convertType(type), range.range)
			return this;
		};
	var cloneFunc = range.cloneRange ? "cloneRange" : "duplicate",
		selectFunc = range.selectNodeContents ? "selectNodeContents" : "moveToElementText";
	
	fn.
	/**
	 * `range.clone()` clones the range and returns a new $.Range
	 * object:
	 *
	 *      var range = new $.Range(document.getElementById('text'));
	 *      var newRange = range.clone();
	 *      range.start('+2');
	 *      range.select();
	 * 
	 * @return {jQuery.Range} returns the range as a $.Range.
	 */
	clone = function(){
		return $.Range( this.range[cloneFunc]() );
	};
	
	fn.
	/**
	 * @function
	 *
	 * `range.select([el])` selects an element with this range.  If nothing
	 * is provided, makes the current range appear as if the user has selected it.
	 * 
	 * This works with text nodes. For example with:
	 *
	 *      <div id="text">This is a text</div>
	 *
	 * $.Range can select `is a` like this:
	 *
	 *      var range = new $.Range(document.getElementById('text'));
	 *      range.start('+5');
	 *      range.end('-5');
	 *      range.select();
	 *
	 * @param {HTMLElement} [el] The element in which this range should be selected
	 * @return {jQuery.Range} the range for chaining.
	 */
	select = range.selectNodeContents ? function(el){
		if(!el){
			var selection = this.window().getSelection();
			selection.removeAllRanges();
			selection.addRange(this.range);
		}else {
			this.range.selectNodeContents(el);
		}
		return this;
	} : function(el){
		if(!el){
			this.range.select()
		} else if(el.nodeType === 3){
			//select this node in the element ...
			var parent = el.parentNode,
				start = 0,
				end;
			iterate(parent.childNodes, function(txtNode){
				if(txtNode === el){
					end = start + txtNode.nodeValue.length;
					return false;
				} else {
					start = start + txtNode.nodeValue.length
				}
			})
			this.range.moveToElementText(parent);
			
			this.range.moveEnd('character', end - this.range.text.length)
			this.range.moveStart('character', start);
		} else { 
			this.range.moveToElementText(el);
		}
		return this;
	};
	
})();


// helpers  -----------------

// iterates through a list of elements, calls cb on every text node
// if cb returns false, exits the iteration
var iterate = function(elems, cb){
	var elem, start;
	for (var i = 0; elems[i]; i++) {
		elem = elems[i];
		// Get the text from text nodes and CDATA nodes
		if (elem.nodeType === 3 || elem.nodeType === 4) {
			if (cb(elem) === false) {
				return false;
			}
			// Traverse everything else, except comment nodes
		}
		else 
			if (elem.nodeType !== 8) {
				if (iterate(elem.childNodes, cb) === false) {
					return false;
				}
			}
	}

}, 
isText = function(node){
	return node.nodeType === 3 || node.nodeType === 4
},
iteratorMaker = function(toChildren, toNext){
	return function( node, mustMoveRight ) {
		// first try down
		if(node[toChildren] && !mustMoveRight){
			return isText(node[toChildren]) ? 
				node[toChildren] :
			 	arguments.callee(node[toChildren])
		} else if(node[toNext]) {
			return isText(node[toNext]) ? 
				node[toNext] :
			 	arguments.callee(node[toNext])
		} else if(node.parentNode){
			return arguments.callee(node.parentNode, true)
		}
	}
},
getNextTextNode = iteratorMaker("firstChild","nextSibling"),
getPrevTextNode = iteratorMaker("lastChild","previousSibling"),
callMove = function(container, offset, howMany){
	if(isText(container)){
		return move(container, offset+howMany)
	} else {
		return container.childNodes[offset] ?
			move(container.childNodes[offset] , howMany) :
			move(container.lastChild, howMany , true)
		return 
	}
},
move = function(from, howMany, adjust){
	var mover = howMany < 0 ? 
		getPrevTextNode : getNextTextNode;
		
	howMany = Math.abs(howMany);
	
	if(!isText(from)){
		from = mover(from)
	}
	if(adjust){
		//howMany = howMany + from.nodeValue.length
	}
	while(from && howMany >= from.nodeValue.length){
		hasMany  = howMany- from.nodeValue.length;
		from = mover(from)
	}
	return {
		node: from,
		offset: mover === getNextTextNode ?
			howMany : 
			from.nodeValue.length - howMany
	}
},
supportWhitespace,
isWhitespace = function(el){
	if(supportWhitespace == null){
		supportWhitespace = 'isElementContentWhitespace' in el;
	}
	return (supportWhitespace? el.isElementContentWhitespace : 
			(el.nodeType === 3 && '' == el.data.trim()));

}, 
// if a point is within a rectangle
within = function(rect, point){

	return rect.left <= point.clientX && rect.left + rect.width >= point.clientX &&
	rect.top <= point.clientY &&
	rect.top + rect.height >= point.clientY
}, 
// if a rectangle is within another rectangle
withinRect = function(outer, inner){
	return within(outer, {
		clientX: inner.left,
		clientY: inner.top
	}) && //top left
	within(outer, {
		clientX: inner.left + inner.width,
		clientY: inner.top
	}) && //top right
	within(outer, {
		clientX: inner.left,
		clientY: inner.top + inner.height
	}) && //bottom left
	within(outer, {
		clientX: inner.left + inner.width,
		clientY: inner.top + inner.height
	}) //bottom right
}, 
// gets the scroll offset from a window
scrollOffset = function( win){
	var win = win ||window;
		doc = win.document.documentElement, body = win.document.body;
	
	return {
		left: (doc && doc.scrollLeft || body && body.scrollLeft || 0) + (doc.clientLeft || 0),
		top: (doc && doc.scrollTop || body && body.scrollTop || 0) + (doc.clientTop || 0)
	};
};


support.moveToPoint = !!$.Range().range.moveToPoint


})(jQuery);
(function($){

var getWindow = function( element ) {
	return element ? element.ownerDocument.defaultView || element.ownerDocument.parentWindow : window
},
// A helper that uses range to abstract out getting the current start and endPos.
getElementsSelection = function(el, win){
	// get a copy of the current range and a range that spans the element
	var current = $.Range.current(el).clone(),
		entireElement = $.Range(el).select(el);
	// if there is no overlap, there is nothing selected
	if(!current.overlaps(entireElement)){
		return null;
	}
	// if the current range starts before our element
	if(current.compare("START_TO_START", entireElement) < 1){
		// the selection within the element begins at 0
		startPos = 0;
		// move the current range to start at our element
		current.move("START_TO_START",entireElement);
	}else{
		// Make a copy of the element's range.
		// Move it's end to the start of the selected range
		// The length of the copy is the start of the selected
		// range.
		fromElementToCurrent =entireElement.clone();
		fromElementToCurrent.move("END_TO_START", current);
		startPos = fromElementToCurrent.toString().length
	}
	
	// If the current range ends after our element
	if(current.compare("END_TO_END", entireElement) >= 0){
		// the end position is the last character
		endPos = entireElement.toString().length
	}else{
		// otherwise, it's the start position plus the current range
		// TODO: this doesn't seem like it works if current
		// extends to the left of the element.
		endPos = startPos+current.toString().length
	}
	return {
		start: startPos,
		end : endPos
	};
},
// Text selection works differently for selection in an input vs
// normal html elements like divs, spans, and ps.
// This function branches between the various methods of getting the selection.
getSelection = function(el){
	var win = getWindow(el);
	
	// `selectionStart` means this is an input element in a standards browser.
	if (el.selectionStart !== undefined) {

		if(document.activeElement 
		 	&& document.activeElement != el 
			&& el.selectionStart == el.selectionEnd 
			&& el.selectionStart == 0){
			return {start: el.value.length, end: el.value.length};
		}
		return  {start: el.selectionStart, end: el.selectionEnd}
	} 
	// getSelection means a 'normal' element in a standards browser.
	else if(win.getSelection){
		return getElementsSelection(el, win)
	} else{
		// IE will freak out, where there is no way to detect it, so we provide a callback if it does.
		try {
			// The following typically works for input elements in IE:
			if (el.nodeName.toLowerCase() == 'input') {
				var real = getWindow(el).document.selection.createRange(), 
					r = el.createTextRange();
				r.setEndPoint("EndToStart", real);
				
				var start = r.text.length
				return {
					start: start,
					end: start + real.text.length
				}
			}
			// This works on textareas and other elements
			else {
				var res = getElementsSelection(el,win)
				if(!res){
					return res;
				}
				// we have to clean up for ie's textareas which don't count for 
				// newlines correctly
				var current = $.Range.current().clone(),
					r2 = current.clone().collapse().range,
					r3 = current.clone().collapse(false).range;
				
				r2.moveStart('character', -1)
				r3.moveStart('character', -1)
				// if we aren't at the start, but previous is empty, we are at start of newline
				if (res.startPos != 0 && r2.text == "") {
					res.startPos += 2;
				}
				// do a similar thing for the end of the textarea
				if (res.endPos != 0 && r3.text == "") {
					res.endPos += 2;
				}
				
				return res
			}
		}catch(e){
			return {start: el.value.length, end: el.value.length};
		}
	} 
},
// Selects text within an element.  Depending if it's a form element or
// not, or a standards based browser or not, we do different things.
select = function( el, start, end ) {
	var win = getWindow(el);
	// IE behaves bad even if it sorta supports
	// getSelection so we have to try the IE methods first. barf.
	if(el.setSelectionRange){
		if(end === undefined){
            el.focus();
            el.setSelectionRange(start, start);
		} else {
			el.select();
			el.selectionStart = start;
			el.selectionEnd = end;
		}
	} else if (el.createTextRange) {
		//el.focus();
		var r = el.createTextRange();
		r.moveStart('character', start);
		end = end || start;
		r.moveEnd('character', end - el.value.length);
		
		r.select();
	} else if(win.getSelection){
		var	doc = win.document,
			sel = win.getSelection(),
			range = doc.createRange(),
			ranges = [start,  end !== undefined ? end : start];
		getCharElement([el],ranges);
		range.setStart(ranges[0].el, ranges[0].count);
		range.setEnd(ranges[1].el, ranges[1].count);
		
		// removeAllRanges is suprisingly necessary for webkit ... BOOO!
        sel.removeAllRanges();
        sel.addRange(range);
		
	} else if(win.document.body.createTextRange){ //IE's weirdness
		var range = document.body.createTextRange();
		range.moveToElementText(el);
		range.collapse()
		range.moveStart('character', start)
		range.moveEnd('character', end !== undefined ? end : start)
        range.select();
	}

},
// TODO: can this be removed?
// If one of the range values is within start and len, replace the range
// value with the element and its offset.
replaceWithLess = function(start, len, range, el){
	if(typeof range[0] === 'number' && range[0] < len){
			range[0] = {
				el: el,
				count: range[0] - start
			};
	}
	if(typeof range[1] === 'number' && range[1] <= len){
			range[1] = {
				el: el,
				count: range[1] - start
			};;
	}
},
// TODO: can this be removed?
getCharElement = function( elems , range, len ) {
	var elem,
		start;
	
	len = len || 0;
	for ( var i = 0; elems[i]; i++ ) {
		elem = elems[i];
		// Get the text from text nodes and CDATA nodes
		if ( elem.nodeType === 3 || elem.nodeType === 4 ) {
			start = len
			len += elem.nodeValue.length;
			//check if len is now greater than what's in counts
			replaceWithLess(start, len, range, elem ) 
		// Traverse everything else, except comment nodes
		} else if ( elem.nodeType !== 8 ) {
			len = getCharElement( elem.childNodes, range, len );
		}
	}
	return len;
};
/**
 * @parent jQuery.selection
 * @function jQuery.fn.selection
 *
 * Set or retrieve the currently selected text range. It works on all elements:
 *
 *      $('#text').selection(8, 12)
 *      $('#text').selection() // -> { start : 8, end : 12 }
 *
 * @param {Number} [start] Start position of the selection range
 * @param {Number} [end] End position of the selection range
 * @return {Object|jQuery} Returns either the jQuery object when setting the selection or
 * an object containing
 *
 * - __start__ - The number of characters from the start of the element to the start of the selection.
 * - __end__ - The number of characters from the start of the element to the end of the selection.
 *
 * when no arguments are passed.
 */
$.fn.selection = function(start, end){
	if(start !== undefined){
		return this.each(function(){
			select(this, start, end)
		})
	}else{
		return getSelection(this[0])
	}
};
// for testing
$.fn.selection.getCharElement = getCharElement;

})(jQuery);
(function($){
	// Checks if x and y coordinates are within a box with left, top, width and height
   var withinBox = function(x, y, left, top, width, height ){
        return (y >= top &&
                y <  top + height &&
                x >= left &&
                x <  left + width);
    } 
/**
 * @function jQuery.fn.within
 * @parent jQuery.within
 * @plugin jquery/dom/within
 * 
 * Returns all elements matching the selector that touch a given point:
 * 
 *     // get all elements that touch 200x200.
 *     $('*').within(200, 200);
 * 
 * @param {Number} left the position from the left of the page 
 * @param {Number} top the position from the top of the page
 * @param {Boolean} [useOffsetCache=false] cache the dimensions and offset of the elements.
 * @return {jQuery} a jQuery collection of elements whos area
 * overlaps the element position.
 */
$.fn.within= function(left, top, useOffsetCache) {
    var ret = []
    this.each(function(){
        var q = jQuery(this);

        if (this == document.documentElement) {
			return ret.push(this);
		}

	    // uses either the cached offset or .offset()
        var offset = useOffsetCache ? 
						jQuery.data(this,"offsetCache") || jQuery.data(this,"offsetCache", q.offset()) : 
						q.offset();

        // Check if the given coordinates are within the area of the current element
	    var res =  withinBox(left, top,  offset.left, offset.top,
                                    this.offsetWidth, this.offsetHeight );

        if (res) {
	        // Add it to the results
			ret.push(this);
		}
    });
    
    return this.pushStack( jQuery.unique( ret ), "within", left+","+top );
}


/**
 * @function jQuery.fn.withinBox
 * @parent jQuery.within
 *
 * Returns all elements matching the selector that have a given area in common:
 *
 *      $('*').withinBox(200, 200, 100, 100)
 *
 * @param {Number} left the position from the left of the page
 * @param {Number} top the position from the top of the page
 * @param {Number} width the width of the area
 * @param {Number} height the height of the area
 * @param {Boolean} [useOffsetCache=false] cache the dimensions and offset of the elements.
 * @return {jQuery} a jQuery collection of elements whos area
 * overlaps the element position.
 */
$.fn.withinBox = function(left, top, width, height, useOffsetCache){
	var ret = []
    this.each(function(){
        var q = jQuery(this);

        if(this == document.documentElement) return  ret.push(this);

	    // use cached offset or .offset()
        var offset = cache ? 
			jQuery.data(this,"offset") || 
			jQuery.data(this,"offset", q.offset()) : 
			q.offset();


        var ew = q.width(), eh = q.height(),
	        // Checks if the element offset is within the given box
	        res =  !( (offset.top > top+height) || (offset.top +eh < top) || (offset.left > left+width ) || (offset.left+ew < left));

        if(res)
            ret.push(this);
    });
    return this.pushStack( jQuery.unique( ret ), "withinBox", jQuery.makeArray(arguments).join(",") );
}
    
})(jQuery);
(function($){

/**
 * @function jQuery.fn.triggerAsync
 * @parent jQuery.event.pause
 * @plugin jquery/event/default
 *
 * `jQuery.fn.triggerAsync(type, [data], [success], [prevented]` triggers an event and calls success
 * when the event has finished propagating through the DOM and no other handler
 * called `event.preventDefault()` or returned `false`.
 *
 *     $('#panel').triggerAsync('show', function() {
 *        $('#panel').show();
 *     });
 *
 * You can also provide a callback that gets called if `event.preventDefault()` was called on the event:
 *
 *     $('panel').triggerAsync('show', function(){
 *         $('#panel').show();
 *     },function(){ 
 *         $('#other').addClass('error');
 *     });
 *
 * @param {String} type The type of event
 * @param {Object} data The data for the event
 * @param {Function} success a callback function which occurs upon success
 * @param {Function} prevented a callback function which occurs if preventDefault was called
 */
$.fn.triggerAsync = function(type, data, success, prevented){
	if(typeof data == 'function'){
		success = data;
		data = undefined;
	}
	
	if ( this[0] ) {
		var event = $.Event( type ),
			old = event.preventDefault;
		
		event.preventDefault = function(){
			old.apply(this, arguments);
			prevented && prevented(this)
		}
		//event._success= success;
		jQuery.event.trigger( {type: type, _success: success}, data, this[0]  );
	} else{
		success.call(this);
	}
	return this;
}
	


/**
 * @add jQuery.event.special
 */
//cache default types for performance
var types = {}, rnamespaces= /\.(.*)$/, $event = $.event;
/**
 * @attribute default
 * @parent specialevents
 * @plugin jquery/event/default
 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/event/default/default.js
 * @test jquery/event/default/qunit.html
 *
 */
$event.special["default"] = {
	add: function( handleObj ) {
		//save the type
		types[handleObj.namespace.replace(rnamespaces,"")] = true;
		
		
	},
	setup: function() {return true}
}

// overwrite trigger to allow default types
var oldTrigger = $event.trigger;

$event.trigger =  function defaultTriggerer( event, data, elem, onlyHandlers){
	// Event object or event type
	var type = event.type || event,
		namespaces = [],

	// Caller can pass in an Event, Object, or just an event type string
	event = typeof event === "object" ?
		// jQuery.Event object
		event[ jQuery.expando ] ? event :
		// Object literal
		new jQuery.Event( type, event ) :
		// Just the event type (string)
		new jQuery.Event( type );
		
    //event._defaultActions = []; //set depth for possibly reused events
	
	var res = oldTrigger.call($.event, event, data, elem, onlyHandlers);
	
	
	if(!onlyHandlers && !event.isDefaultPrevented() && event.type.indexOf("default") !== 0){
		oldTrigger("default."+event.type, data, elem)
		if(event._success){
			event._success(event)
		}
	}
	// code for paused
	if( event.isPaused && event.isPaused() ){
		// set back original stuff
		event.isDefaultPrevented = 
			event.pausedState.isDefaultPrevented;
		event.isPropagationStopped = 
			event.pausedState.isPropagationStopped;
	}
	return res;
};
	
	
	
	
})(jQuery);
(function( $ ) {
	/**
	 * @attribute destroyed
	 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/dom/destroyed/destroyed.js
	 * @test jquery/event/destroyed/qunit.html
	 */

	// Store the old jQuery.cleanData
	var oldClean = jQuery.cleanData;

	// Overwrites cleanData which is called by jQuery on manipulation methods
	$.cleanData = function( elems ) {
		for ( var i = 0, elem;
		(elem = elems[i]) !== undefined; i++ ) {
			// Trigger the destroyed event
			$(elem).triggerHandler("destroyed");
		}
		// Call the old jQuery.cleanData
		oldClean(elems);
	};

})(jQuery);
(function($){
	var getSetZero = function(v){ return v !== undefined ? (this.array[0] = v) : this.array[0] },
		getSetOne = function(v){ return v !== undefined ? (this.array[1] = v) : this.array[1]};

/**
 * @class jQuery.Vector
 * @parent jquerypp
 *
 * `jQuery.Vector` represents a multi dimensional vector with shorthand methods for
 * working with two dimensions.
 *
 * It is mainly used in [jQuery.event.drag drag] & [jQuery.event.drop drop] events.
 *
 * @constructor creates a new vector instance from the arguments.  Example:
 *
 *      new jQuery.Vector(1,2)
 */
	$.Vector = function(arr) {
		var array = $.isArray(arr) ? arr : $.makeArray(arguments);
		this.update(array);
	};
	$.Vector.prototype =
	/* @Prototype*/
	{
		/**
		 * Applys the function to every item in the vector and returns a new vector.
		 *
		 * @param {Function} f The function to apply
		 * @return {jQuery.Vector} A new $.Vector instance
		 */
		app: function( f ) {
			var i, newArr = [];

			for ( i = 0; i < this.array.length; i++ ) {
				newArr.push(f(this.array[i], i));
			}
			return new $.Vector(newArr);
		},
		/**
		 * Adds two vectors together and returns a new instance. Example:
		 *
		 *      new $.Vector(1,2).plus(2,3) //-> (3, 5)
		 *      new $.Vector(3,5).plus(new Vector(4,5)) //-> (7, 10)
		 *
		 * @return {$.Vector}
		 */
		plus: function() {
			var i, args = arguments[0] instanceof $.Vector ? arguments[0].array : $.makeArray(arguments),
				arr = this.array.slice(0),
				vec = new $.Vector();
			for ( i = 0; i < args.length; i++ ) {
				arr[i] = (arr[i] ? arr[i] : 0) + args[i];
			}
			return vec.update(arr);
		},
		/**
		 * Subtract one vector from another and returns a new instance. Example:
		 *
		 *      new $.Vector(4, 5).minus(2, 1) //-> (2, 4)
		 *
		 * @return {jQuery.Vector}
		 */
		minus: function() {
			var i, args = arguments[0] instanceof $.Vector ? arguments[0].array : $.makeArray(arguments),
				arr = this.array.slice(0),
				vec = new $.Vector();
			for ( i = 0; i < args.length; i++ ) {
				arr[i] = (arr[i] ? arr[i] : 0) - args[i];
			}
			return vec.update(arr);
		},
		/**
		 * Returns the current vector if it is equal to the vector passed in.
		 *
		 * `null` if otherwise.
		 *
		 * @return {jQuery.Vector}
		 */
		equals: function() {
			var i, args = arguments[0] instanceof $.Vector ? arguments[0].array : $.makeArray(arguments),
				arr = this.array.slice(0),
				vec = new $.Vector();
			for ( i = 0; i < args.length; i++ ) {
				if ( arr[i] != args[i] ) {
					return null;
				}
			}
			return vec.update(arr);
		},
		/**
		 * Returns the first value of the vector.
		 * You can also access the same value through the following aliases the
		 * [jQuery.Vector.prototype.left vector.left()] and [jQuery.Vector.prototype.left vector.width()]
		 * aliases.
		 *
		 * For example:
		 *
		 *      var v = new $.Vector(2, 5);
		 *      v.x() //-> 2
		 *      v.left() //-> 2
		 *      v.width() //-> 2
		 *
		 * @return {Number} The first value of the vector
		 */
		x: getSetZero,
		/**
		 * @hide
		 * Alias for [jQuery.Vector.prototype.x].
		 *
		 * @return {Number}
		 */
		left: getSetZero,
		/**
		 * @hide
		 * Alias for [jQuery.Vector.prototype.x].
		 *
		 * @return {Number}
		 */
		width: getSetZero,
		/**
		 * Returns the second value of the vector.
		 * You can also access the same value through the [jQuery.Vector.prototype.top vector.top()]
		 * and [jQuery.Vector.prototype.height vector.height()] aliases.
		 *
		 * For example:
		 *
		 *      var v = new $.Vector(2, 5);
		 *      v.y() //-> 5
		 *      v.top() //-> 5
		 *      v.height() //-> 5
		 *
		 * @return {Number} The first value of the vector
		 */
		y: getSetOne,
		/**
		 * @hide
		 * Alias for [jQuery.Vector.prototype.y].
		 *
		 * @return {Number}
		 */
		top: getSetOne,
		/**
		 * @hide
		 * Alias for [jQuery.Vector.prototype.y].
		 *
		 * @return {Number}
		 */
		height: getSetOne,
		/**
		 * Returns a string representation of the vector in the form of (x,y,...)
		 *
		 *      var v = new $.Vector(4, 6, 1, 3);
		 *      v.toString() //-> (4, 6, 1, 3)
		 *
		 * @return {String}
		 */
		toString: function() {
			return "(" + this.array.join(', ') + ")";
		},
		/**
		 * Replaces the vectors contents
		 *
		 *      var v = new $.Vector(2, 3);
		 *
		 * @param {Object} array
		 */
		update: function( array ) {
			var i;
			if ( this.array ) {
				for ( i = 0; i < this.array.length; i++ ) {
					delete this.array[i];
				}
			}
			this.array = array;
			for ( i = 0; i < array.length; i++ ) {
				this[i] = this.array[i];
			}
			return this;
		}
	};

	$.Event.prototype.vector = function() {
		if ( this.originalEvent.synthetic ) {
			var doc = document.documentElement,
				body = document.body;
			return new $.Vector(this.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc.clientLeft || 0), this.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc.clientTop || 0));
		} else {
			return new $.Vector(this.pageX, this.pageY);
		}
	};

	$.fn.offsetv = function() {
		if ( this[0] == window ) {
			return new $.Vector(window.pageXOffset ? window.pageXOffset : document.documentElement.scrollLeft, window.pageYOffset ? window.pageYOffset : document.documentElement.scrollTop);
		} else {
			var offset = this.offset();
			return new $.Vector(offset.left, offset.top);
		}
	};

	$.fn.dimensionsv = function( which ) {
		if ( this[0] == window || !which ) {
			return new $.Vector(this.width(), this.height());
		}
		else {
			return new $.Vector(this[which + "Width"](), this[which + "Height"]());
		}
	};
})(jQuery);
(function() {

	var event = jQuery.event,

		//helper that finds handlers by type and calls back a function, this is basically handle
		// events - the events object
		// types - an array of event types to look for
		// callback(type, handlerFunc, selector) - a callback
		// selector - an optional selector to filter with, if there, matches by selector
		//     if null, matches anything, otherwise, matches with no selector
		findHelper = function( events, types, callback, selector ) {
			var t, type, typeHandlers, all, h, handle, 
				namespaces, namespace,
				match;
			for ( t = 0; t < types.length; t++ ) {
				type = types[t];
				all = type.indexOf(".") < 0;
				if (!all ) {
					namespaces = type.split(".");
					type = namespaces.shift();
					namespace = new RegExp("(^|\\.)" + namespaces.slice(0).sort().join("\\.(?:.*\\.)?") + "(\\.|$)");
				}
				typeHandlers = (events[type] || []).slice(0);

				for ( h = 0; h < typeHandlers.length; h++ ) {
					handle = typeHandlers[h];
					
					match = (all || namespace.test(handle.namespace));
					
					if(match){
						if(selector){
							if (handle.selector === selector  ) {
								callback(type, handle.origHandler || handle.handler);
							}
						} else if (selector === null){
							callback(type, handle.origHandler || handle.handler, handle.selector);
						}
						else if (!handle.selector ) {
							callback(type, handle.origHandler || handle.handler);
							
						} 
					}
					
					
				}
			}
		};

	/**
	 * Finds event handlers of a given type on an element.
	 * @param {HTMLElement} el
	 * @param {Array} types an array of event names
	 * @param {String} [selector] optional selector
	 * @return {Array} an array of event handlers
	 */
	event.find = function( el, types, selector ) {
		var events = ( $._data(el) || {} ).events,
			handlers = [],
			t, liver, live;

		if (!events ) {
			return handlers;
		}
		findHelper(events, types, function( type, handler ) {
			handlers.push(handler);
		}, selector);
		return handlers;
	};
	/**
	 * Finds all events.  Group by selector.
	 * @param {HTMLElement} el the element
	 * @param {Array} types event types
	 */
	event.findBySelector = function( el, types ) {
		var events = $._data(el).events,
			selectors = {},
			//adds a handler for a given selector and event
			add = function( selector, event, handler ) {
				var select = selectors[selector] || (selectors[selector] = {}),
					events = select[event] || (select[event] = []);
				events.push(handler);
			};

		if (!events ) {
			return selectors;
		}
		//first check live:
		/*$.each(events.live || [], function( i, live ) {
			if ( $.inArray(live.origType, types) !== -1 ) {
				add(live.selector, live.origType, live.origHandler || live.handler);
			}
		});*/
		//then check straight binds
		findHelper(events, types, function( type, handler, selector ) {
			add(selector || "", type, handler);
		}, null);

		return selectors;
	};
	event.supportTouch = "ontouchend" in document;
	
	$.fn.respondsTo = function( events ) {
		if (!this.length ) {
			return false;
		} else {
			//add default ?
			return event.find(this[0], $.isArray(events) ? events : [events]).length > 0;
		}
	};
	$.fn.triggerHandled = function( event, data ) {
		event = (typeof event == "string" ? $.Event(event) : event);
		this.trigger(event, data);
		return event.handled;
	};
	/**
	 * Only attaches one event handler for all types ...
	 * @param {Array} types llist of types that will delegate here
	 * @param {Object} startingEvent the first event to start listening to
	 * @param {Object} onFirst a function to call 
	 */
	event.setupHelper = function( types, startingEvent, onFirst ) {
		if (!onFirst ) {
			onFirst = startingEvent;
			startingEvent = null;
		}
		var add = function( handleObj ) {

			var bySelector, selector = handleObj.selector || "";
			if ( selector ) {
				bySelector = event.find(this, types, selector);
				if (!bySelector.length ) {
					$(this).delegate(selector, startingEvent, onFirst);
				}
			}
			else {
				//var bySelector = event.find(this, types, selector);
				if (!event.find(this, types, selector).length ) {
					event.add(this, startingEvent, onFirst, {
						selector: selector,
						delegate: this
					});
				}

			}

		},
			remove = function( handleObj ) {
				var bySelector, selector = handleObj.selector || "";
				if ( selector ) {
					bySelector = event.find(this, types, selector);
					if (!bySelector.length ) {
						$(this).undelegate(selector, startingEvent, onFirst);
					}
				}
				else {
					if (!event.find(this, types, selector).length ) {
						event.remove(this, startingEvent, onFirst, {
							selector: selector,
							delegate: this
						});
					}
				}
			};
		$.each(types, function() {
			event.special[this] = {
				add: add,
				remove: remove,
				setup: function() {},
				teardown: function() {}
			};
		});
	};
})(jQuery);
(function( $ ) {
	//modify live
	//steal the live handler ....
	var bind = function( object, method ) {
		var args = Array.prototype.slice.call(arguments, 2);
		return function() {
			var args2 = [this].concat(args, $.makeArray(arguments));
			return method.apply(object, args2);
		};
	},
		event = $.event,
		clearSelection = window.getSelection ? function(){
				window.getSelection().removeAllRanges()
			} : function(){};
	// var handle = event.handle; //unused
	/**
	 * @class jQuery.Drag
	 * @parent jQuery.event.drag
	 * @plugin jquery/event/drag
	 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/event/drag/drag.js
	 * @test jquery/event/drag/qunit.html
	 *
	 * The `$.Drag` constructor is never called directly but an instance of `$.Drag` is passed as the second argument
	 * to the `dragdown`, `draginit`, `dragmove`, `dragend`, `dragover` and `dragout` event handlers:
	 *
	 *      $('#dragger').on('draginit', function(el, drag) {
	 *          // drag -> $.Drag
	 *      });
	 */
	$.Drag = function() {};

	/**
	 * @Static
	 */
	$.extend($.Drag, {
		lowerName: "drag",
		current: null,
		distance: 0,
		/**
		 * Called when someone mouses down on a draggable object.
		 * Gathers all callback functions and creates a new Draggable.
		 * @hide
		 */
		mousedown: function( ev, element ) {
			var isLeftButton = ev.button === 0 || ev.button == 1;
			if (!isLeftButton || this.current ) {
				return;
			} //only allows 1 drag at a time, but in future could allow more
			//ev.preventDefault();
			//create Drag
			var drag = new $.Drag(),
				delegate = ev.delegateTarget || element,
				selector = ev.handleObj.selector,
				self = this;
			this.current = drag;

			drag.setup({
				element: element,
				delegate: ev.delegateTarget || element,
				selector: ev.handleObj.selector,
				moved: false,
				_distance: this.distance,
				callbacks: {
					dragdown: event.find(delegate, ["dragdown"], selector),
					draginit: event.find(delegate, ["draginit"], selector),
					dragover: event.find(delegate, ["dragover"], selector),
					dragmove: event.find(delegate, ["dragmove"], selector),
					dragout: event.find(delegate, ["dragout"], selector),
					dragend: event.find(delegate, ["dragend"], selector)
				},
				destroyed: function() {
					self.current = null;
				}
			}, ev);
		}
	});
	
	/**
	 * @Prototype
	 */
	$.extend($.Drag.prototype, {
		setup: function( options, ev ) {
			$.extend(this, options);
			this.element = $(this.element);
			this.event = ev;
			this.moved = false;
			this.allowOtherDrags = false;
			var mousemove = bind(this, this.mousemove),
				mouseup = bind(this, this.mouseup);
			this._mousemove = mousemove;
			this._mouseup = mouseup;
			this._distance = options.distance ? options.distance : 0;
			
			this.mouseStartPosition = ev.vector(); //where the mouse is located
			
			$(document).bind('mousemove', mousemove);
			$(document).bind('mouseup', mouseup);

			if (!this.callEvents('down', this.element, ev) ) {
			    this.noSelection(this.delegate);
				//this is for firefox
				clearSelection();
			}
		},
		/**
		 * @attribute element
		 * A reference to the element that is being dragged. For example:
		 *
		 *      $('.draggable').on('draginit', function(ev, drag) {
		 *          drag.element.html('I am the drag element');
		 *      });
		 */

		/**
		 * Unbinds listeners and allows other drags ...
		 * @hide
		 */
		destroy: function() {
			$(document).unbind('mousemove', this._mousemove);
			$(document).unbind('mouseup', this._mouseup);
			if (!this.moved ) {
				this.event = this.element = null;
			}

            this.selection(this.delegate);
			this.destroyed();
		},
		mousemove: function( docEl, ev ) {
			if (!this.moved ) {
				var dist = Math.sqrt( Math.pow( ev.pageX - this.event.pageX, 2 ) + Math.pow( ev.pageY - this.event.pageY, 2 ));
				if(dist < this._distance){
					return false;
				}
				
				this.init(this.element, ev);
				this.moved = true;
			}

			var pointer = ev.vector();
			if ( this._start_position && this._start_position.equals(pointer) ) {
				return;
			}
			//e.preventDefault();
			this.draw(pointer, ev);
		},
		
		mouseup: function( docEl, event ) {
			//if there is a current, we should call its dragstop
			if ( this.moved ) {
				this.end(event);
			}
			this.destroy();
		},

        /**
         * The `drag.noSelection(element)` method turns off text selection during a drag event.
         * This method is called by default unless a event is listening to the 'dragdown' event.
         *
         * ## Example
         *
         *      $('div.drag').bind('dragdown', function(elm,event,drag){
         *          drag.noSelection();
         *      });
         *      
         * @param [elm] an element to prevent selection on.  Defaults to the dragable element.
         */
		noSelection: function(elm) {
            elm = elm || this.delegate
            
			document.documentElement.onselectstart = function() {
				return false;
			};
			document.documentElement.unselectable = "on";
			this.selectionDisabled = (this.selectionDisabled ? this.selectionDisabled.add(elm) : $(elm));
			this.selectionDisabled.css('-moz-user-select', '-moz-none');
		},

        /**
         * @hide
         * `drag.selection()` method turns on text selection that was previously turned off during the drag event.
         * This method is always called.
         * 
         * ## Example
         *
         *     $('div.drag').bind('dragdown', function(elm,event,drag){
         *       drag.selection();
         *     });
         */
		selection: function() {
            if(this.selectionDisabled){
                document.documentElement.onselectstart = function() {};
                document.documentElement.unselectable = "off";
                this.selectionDisabled.css('-moz-user-select', '');
            }
		},

		init: function( element, event ) {
			element = $(element);
			var startElement = (this.movingElement = (this.element = $(element))); //the element that has been clicked on
			//if a mousemove has come after the click
			this._cancelled = false; //if the drag has been cancelled
			this.event = event;
			
			/**
			 * @attribute mouseElementPosition
			 * The position of start of the cursor on the element
			 */
			this.mouseElementPosition = this.mouseStartPosition.minus(this.element.offsetv()); //where the mouse is on the Element
			//this.callStart(element, event);
			this.callEvents('init', element, event);

			//Check what they have set and respond accordingly
			//  if they canceled
			if ( this._cancelled === true ) {
				return;
			}
			//if they set something else as the element
			this.startPosition = startElement != this.movingElement ? this.movingElement.offsetv() : this.currentDelta();

			this.makePositioned(this.movingElement);
			this.oldZIndex = this.movingElement.css('zIndex');
			this.movingElement.css('zIndex', 1000);
			if (!this._only && this.constructor.responder ) {
				this.constructor.responder.compile(event, this);
			}
		},
		makePositioned: function( that ) {
			var style, pos = that.css('position');

			if (!pos || pos == 'static' ) {
				style = {
					position: 'relative'
				};

				if ( window.opera ) {
					style.top = '0px';
					style.left = '0px';
				}
				that.css(style);
			}
		},
		callEvents: function( type, element, event, drop ) {
			var i, cbs = this.callbacks[this.constructor.lowerName + type];
			for ( i = 0; i < cbs.length; i++ ) {
				cbs[i].call(element, event, this, drop);
			}
			return cbs.length;
		},
		/**
		 * Returns the position of the movingElement by taking its top and left.
		 * @hide
		 * @return {Vector}
		 */
		currentDelta: function() {
			return new $.Vector(parseInt(this.movingElement.css('left'), 10) || 0, parseInt(this.movingElement.css('top'), 10) || 0);
		},
		//draws the position of the dragmove object
		draw: function( pointer, event ) {
			// only drag if we haven't been cancelled;
			if ( this._cancelled ) {
				return;
			}
			clearSelection();
			/**
			 * @attribute location
			 * `drag.location` is a [jQuery.Vector] specifying where the element should be in the page.  This
			 * takes into account the start position of the cursor on the element.
			 * 
			 * If the drag is going to be moved to an unacceptable location, you can call preventDefault in
			 * dragmove to prevent it from being moved there.
			 * 
			 *     $('.mover').bind("dragmove", function(ev, drag){
			 *       if(drag.location.top() < 100){
			 *         ev.preventDefault()
			 *       }
			 *     });
			 *     
			 * You can also set the location to where it should be on the page.
			 * 
			 */
			this.location = pointer.minus(this.mouseElementPosition); // the offset between the mouse pointer and the representative that the user asked for
			// position = mouse - (dragOffset - dragTopLeft) - mousePosition
			
			// call move events
			this.move(event);
			if ( this._cancelled ) {
				return;
			}
			if (!event.isDefaultPrevented() ) {
				this.position(this.location);
			}

			//fill in
			if (!this._only && this.constructor.responder ) {
				this.constructor.responder.show(pointer, this, event);
			}
		},
		/**
		 * `drag.position( newOffsetVector )` sets the position of the movingElement.  This is overwritten by
		 * the [$.Drag::scrolls], [$.Drag::limit] and [$.Drag::step] plugins 
		 * to make sure the moving element scrolls some element
		 * or stays within some boundary.  This function is exposed and documented so you could do the same.
		 * 
		 * The following approximates how step does it:
		 * 
		 *     var oldPosition = $.Drag.prototype.position;
		 *     $.Drag.prototype.position = function( offsetPositionv ) {
		 *       if(this._step){
		 *         // change offsetPositionv to be on the step value
		 *       }
		 *       
		 *       oldPosition.call(this, offsetPosition)
		 *     }
		 * 
		 * @param {jQuery.Vector} newOffsetv the new [$.Drag::location] of the element.
		 */
		position: function( newOffsetv ) { //should draw it on the page
			var style, dragged_element_css_offset = this.currentDelta(),
				//  the drag element's current left + top css attributes
				dragged_element_position_vector = // the vector between the movingElement's page and css positions
				this.movingElement.offsetv().minus(dragged_element_css_offset); // this can be thought of as the original offset
			this.required_css_position = newOffsetv.minus(dragged_element_position_vector);

			this.offsetv = newOffsetv;
			//dragged_element vector can probably be cached.
			style = this.movingElement[0].style;
			if (!this._cancelled && !this._horizontal ) {
				style.top = this.required_css_position.top() + "px";
			}
			if (!this._cancelled && !this._vertical ) {
				style.left = this.required_css_position.left() + "px";
			}
		},
		move: function( event ) {
			this.callEvents('move', this.element, event);
		},
		over: function( event, drop ) {
			this.callEvents('over', this.element, event, drop);
		},
		out: function( event, drop ) {
			this.callEvents('out', this.element, event, drop);
		},
		/**
		 * Called on drag up
		 * @hide
		 * @param {Event} event a mouseup event signalling drag/drop has completed
		 */
		end: function( event ) {
			if ( this._cancelled ) {
				return;
			}
			if (!this._only && this.constructor.responder ) {
				this.constructor.responder.end(event, this);
			}

			this.callEvents('end', this.element, event);

			if ( this._revert ) {
				var self = this;
				this.movingElement.animate({
					top: this.startPosition.top() + "px",
					left: this.startPosition.left() + "px"
				}, function() {
					self.cleanup.apply(self, arguments);
				});
			}
			else {
				this.cleanup();
			}
			this.event = null;
		},
		/**
		 * Cleans up drag element after drag drop.
		 * @hide
		 */
		cleanup: function() {
			this.movingElement.css({
				zIndex: this.oldZIndex
			});
			if ( this.movingElement[0] !== this.element[0] && 
				!this.movingElement.has(this.element[0]).length && 
				!this.element.has(this.movingElement[0]).length ) {
				this.movingElement.css({
					display: 'none'
				});
			}
			if ( this._removeMovingElement ) {
				this.movingElement.remove();
			}

			this.movingElement = this.element = this.event = null;
		},
		/**
		 * `drag.cancel()` stops a drag motion from from running.  This also stops any other events from firing, meaning
		 * that "dragend" will not be called.
		 * 
		 *     $("#todos").on(".handle", "draginit", function( ev, drag ) {
		 *       if(drag.movingElement.hasClass("evil")){
		 *         drag.cancel();	
		 *       }
		 *     })
		 * 
		 */
		cancel: function() {
			this._cancelled = true;
			//this.end(this.event);
			if (!this._only && this.constructor.responder ) {
				this.constructor.responder.clear(this.event.vector(), this, this.event);
			}
			this.destroy();

		},
		/**
		 * `drag.ghost( [parent] )` clones the element and uses it as the 
		 * moving element, leaving the original dragged element in place.  The `parent` option can
		 * be used to specify where the ghost element should be temporarily added into the 
		 * DOM.  This method should be called in "draginit".
		 * 
		 *     $("#todos").on(".handle", "draginit", function( ev, drag ) {
		 *       drag.ghost();
		 *     })
		 * 
		 * @param {HTMLElement} [parent] the parent element of the newly created ghost element. If not provided the 
		 * ghost element is added after the moving element.
		 * @return {jQuery.fn} the ghost element to do whatever you want with it.
		 */
		ghost: function( parent ) {
			// create a ghost by cloning the source element and attach the clone to the dom after the source element
			var ghost = this.movingElement.clone().css('position', 'absolute');
			if( parent ) {
				$(parent).append(ghost);
			} else {
				$(this.movingElement).after(ghost)
			}
			ghost.width(this.movingElement.width()).height(this.movingElement.height());
			// put the ghost in the right location ...
			ghost.offset(this.movingElement.offset())
			
			// store the original element and make the ghost the dragged element
			this.movingElement = ghost;
			this.noSelection(ghost)
			this._removeMovingElement = true;
			return ghost;
		},
		/**
		 * `drag.representative( element, [offsetX], [offsetY])` tells the drag motion to use
		 * a different element than the one that began the drag motion. 
		 * 
		 * For example, instead of
		 * dragging an drag-icon of a todo element, you want to move some other representation of
		 * the todo element (or elements).  To do this you might:
		 * 
		 *     $("#todos").on(".handle", "draginit", function( ev, drag ) {
		 *       // create what we'll drag
		 *       var rep = $('<div/>').text("todos")
		 *         .appendTo(document.body)
		 *       // indicate we want our mouse on the top-right of it
		 *       drag.representative(rep, rep.width(), 0);
		 *     })
		 * 
		 * @param {HTMLElement} element the element you want to actually drag.  This should be 
		 * already in the DOM.
		 * @param {Number} offsetX the x position where you want your mouse on the representative element (defaults to 0)
		 * @param {Number} offsetY the y position where you want your mouse on the representative element (defaults to 0)
		 * @return {drag} returns the drag object for chaining.
		 */
		representative: function( element, offsetX, offsetY ) {
			this._offsetX = offsetX || 0;
			this._offsetY = offsetY || 0;

			var p = this.mouseStartPosition;

			this.movingElement = $(element);
			this.movingElement.css({
				top: (p.y() - this._offsetY) + "px",
				left: (p.x() - this._offsetX) + "px",
				display: 'block',
				position: 'absolute'
			}).show();
			this.noSelection(this.movingElement)
			this.mouseElementPosition = new $.Vector(this._offsetX, this._offsetY);
			return this;
		},
		/**
		 * `drag.revert([val])` makes the [$.Drag::representative representative] element revert back to it
		 * original position after the drag motion has completed.  The revert is done with an animation.
		 * 
		 *     $("#todos").on(".handle","dragend",function( ev, drag ) {
		 *       drag.revert();
		 *     })
		 * 
		 * @param {Boolean} [val] optional, set to false if you don't want to revert.
		 * @return {drag} the drag object for chaining
		 */
		revert: function( val ) {
			this._revert = val === undefined ? true : val;
			return this;
		},
		/**
		 * `drag.vertical()` isolates the drag to vertical movement.  For example:
		 * 
		 *     $("#images").on(".thumbnail","draginit", function(ev, drag){
		 *       drag.vertical();
		 *     });
		 * 
		 * Call `vertical()` in "draginit" or "dragdown".
		 * 
		 * @return {drag} the drag object for chaining.
		 */
		vertical: function() {
			this._vertical = true;
			return this;
		},
		/**
		 * `drag.horizontal()` isolates the drag to horizontal movement.  For example:
		 * 
		 *     $("#images").on(".thumbnail","draginit", function(ev, drag){
		 *       drag.horizontal();
		 *     });
		 * 
		 * Call `horizontal()` in "draginit" or "dragdown".
		 * 
		 * @return {drag} the drag object for chaining.
		 */
		horizontal: function() {
			this._horizontal = true;
			return this;
		},
		/**
		 * `drag.only([only])` indicates if you __only__ want a drag motion and the drag should
		 * not notify drops.  The default value is `false`.  Call it with no arguments or pass it true
		 * to prevent drop events.
		 * 
		 *     $("#images").on(".thumbnail","dragdown", function(ev, drag){
		 * 	     drag.only();
		 *     });
		 * 
		 * @param {Boolean} [only] true if you want to prevent drops, false if otherwise.
		 * @return {Boolean} the current value of only.
		 */
		only: function( only ) {
			return (this._only = (only === undefined ? true : only));
		},
		
		/**
		 * `distance([val])` sets or reads the distance the mouse must move before a drag motion is started.  This should be set in
		 * "dragdown" and delays "draginit" being called until the distance is covered.  The distance
		 * is measured in pixels.  The default distance is 0 pixels meaning the drag motion starts on the first
		 * mousemove after a mousedown.
		 * 
		 * Set this to make drag motion a little "stickier" to start.
		 * 
		 *     $("#images").on(".thumbnail","dragdown", function(ev, drag){
		 *       drag.distance(10);
		 *     });
		 * 
		 * @param {Number} [val] The number of pixels the mouse must move before "draginit" is called.
		 * @return {drag|Number} returns the drag instance for chaining if the drag value is being set or the
		 * distance value if the distance is being read.
		 */
		distance:function(val){
			if(val !== undefined){
				this._distance = val;
				return this;
			}else{
				return this._distance
			}
		}
	});
	/**
	 * @add jQuery.event.special
	 */
	event.setupHelper([
	/**
	 * @attribute dragdown
	 * @parent jQuery.event.drag
	 * 
	 * `dragdown` is called when a drag movement has started on a mousedown.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second
	 * parameter.  Listening to `dragdown` allows you to customize 
	 * the behavior of a drag motion, especially when `draginit` should be called.
	 * 
	 *     $(".handles").delegate("dragdown", function(ev, drag){
	 *       // call draginit only when the mouse has moved 20 px
	 *       drag.distance(20);
	 *     })
	 * 
	 * Typically, when a drag motion is started, `event.preventDefault` is automatically
	 * called, preventing text selection.  However, if you listen to 
	 * `dragdown`, this default behavior is not called. You are responsible for calling it
	 * if you want it (you probably do).
	 *
	 * ### Why might you not want to call `preventDefault`?
	 *
	 * You might want it if you want to allow text selection on element
	 * within the drag element.  Typically these are input elements.
	 *
	 *     $(".handles").delegate("dragdown", function(ev, drag){
	 *       if(ev.target.nodeName === "input"){
	 *         drag.cancel();
	 *       } else {
	 *         ev.preventDefault();
	 *       }
	 *     })
	 */
	'dragdown',
	/**
	 * @attribute draginit
	 * @parent jQuery.event.drag
	 *
	 * `draginit` is triggered when the drag motion starts. Use it to customize the drag behavior
	 * using the [jQuery.Drag] instance passed as the second parameter:
	 *
	 *     $(".draggable").on('draginit', function(ev, drag) {
	 *       // Only allow vertical drags
	 *       drag.vertical();
	 *       // Create a draggable copy of the element
	 *       drag.ghost();
	 *     });
	 */
	'draginit',
	/**
	 * @attribute dragover
	 * @parent jQuery.event.drag
	 *
	 * `dragover` is triggered when a drag is over a [jQuery.event.drop drop element].
	 * The event handler gets an instance of [jQuery.Drag] passed as the second
	 * parameter and an instance of [jQuery.Drop] passed as the third argument:
	 *
	 *      $('.draggable').on('dragover', function(ev, drag, drop) {
	 *          // Add the drop-here class indicating that the drag
	 *          // can be dropped here
	 *          drag.element.addClass('drop-here');
	 *      });
	 */
	'dragover',
	/**
	 * @attribute dragmove
	 * @parent jQuery.event.drag
	 *
	 * `dragmove` is triggered when the drag element moves (similar to a mousemove).
	 * The event handler gets an instance of [jQuery.Drag] passed as the second
	 * parameter.
	 * Use [jQuery.Drag::location] to determine the current position
	 * as a [jQuery.Vector vector].
	 *
	 * For example, `dragmove` can be used to create a draggable element to resize
	 * a container:
	 *
	 *      $('.resizer').on('dragmove', function(ev, drag) {
	 *          $('#container').width(drag.location.x())
	 *              .height(drag.location.y());
	 *      });
	 */
	'dragmove',
	/**
	 * @attribute dragout
	 * @parent jQuery.event.drag
	 *
	 * `dragout` is called when the drag leaves a drop point.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second
	 * parameter.
	 *
	 *      $('.draggable').on('dragout', function(ev, drag) {
	 *      	 // Remove the drop-here class
	 *      	 // (e.g. crossing the drag element out indicating that it
	 *      	 // can't be dropped here
	 *          drag.element.removeClass('drop-here');
	 *      });
	 */
	'dragout',
	/**
	 * @attribute dragend
	 * @parent jQuery.event.drag
	 *
	 * `dragend` is called when the drag motion is done.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second
	 * parameter.
	 *
	 *     $('.draggable').on('dragend', function(ev, drag)
	 *       // Clean up when the drag motion is done
	 *     });
	 */
	'dragend'], "mousedown", function( e ) {
		$.Drag.mousedown.call($.Drag, e, this);

	});
})(jQuery);
(function( $ ) {


	$.Drag.prototype
	/**
	 * @function limit
	 * @plugin jquery/event/drag/limit
	 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/event/event/drag/limit/limit.js
	 * `drag.limit(container, [center])` limits a drag to a containing element.
	 * 
	 *     $("#todos").on(".todo","draginit", function( ev, drag ) {
	 *       drag.limit($("#todos").parent())
	 *     })
	 * 
	 * @param {jQuery} container the jQuery-wrapped container element you do not want the drag element to escape.
	 * @param {String} [center] can set the limit to the center of the object.  Can be 
	 *   'x', 'y' or 'both'.  By default it will keep the outer edges of the moving element within the
	 * container element.  If you provide x, it will keep the horizontal center of the moving element
	 * within the container element.  If you provide y, it will keep the vertical center of the moving
	 * element within the container element.  If you provide both, it will keep the center of the 
	 * moving element within the containing element.
	 * @return {drag} returns the drag for chaining.
	 */
	.limit = function( container, center ) {
		//on draws ... make sure this happens
		var styles = container.styles('borderTopWidth', 'paddingTop', 'borderLeftWidth', 'paddingLeft'),
			paddingBorder = new $.Vector(
			parseInt(styles.borderLeftWidth, 10) + parseInt(styles.paddingLeft, 10) || 0, parseInt(styles.borderTopWidth, 10) + parseInt(styles.paddingTop, 10) || 0);

		this._limit = {
			offset: container.offsetv().plus(paddingBorder),
			size: container.dimensionsv(),
			center : center === true ? 'both' : center
		};
		return this;
	};

	var oldPosition = $.Drag.prototype.position;
	$.Drag.prototype.position = function( offsetPositionv ) {
		//adjust required_css_position accordingly
		if ( this._limit ) {
			var limit = this._limit,
				center = limit.center && limit.center.toLowerCase(),
				movingSize = this.movingElement.dimensionsv('outer'),
				halfHeight = center && center != 'x' ? movingSize.height() / 2 : 0,
				halfWidth = center && center != 'y' ? movingSize.width() / 2 : 0,
				lot = limit.offset.top(),
				lof = limit.offset.left(),
				height = limit.size.height(),
				width = limit.size.width();

			//check if we are out of bounds ...
			//above
			if ( offsetPositionv.top()+halfHeight < lot ) {
				offsetPositionv.top(lot - halfHeight);
			}
			//below
			if ( offsetPositionv.top() + movingSize.height() - halfHeight > lot + height ) {
				offsetPositionv.top(lot + height - movingSize.height() + halfHeight);
			}
			//left
			if ( offsetPositionv.left()+halfWidth < lof ) {
				offsetPositionv.left(lof - halfWidth);
			}
			//right
			if ( offsetPositionv.left() + movingSize.width() -halfWidth > lof + width ) {
				offsetPositionv.left(lof + width - movingSize.left()+halfWidth);
			}
		}

		oldPosition.call(this, offsetPositionv);
	};

})(jQuery);
(function($){
	var event = $.event;
	//somehow need to keep track of elements with selectors on them.  When element is removed, somehow we need to know that
	//
	/**
	 * @add jQuery.event.special
	 */
	var eventNames = [
	/**
	 * @attribute dropover
	 * @parent jQuery.event.drop
	 * 
	 * `dropover` is triggered when a [jQuery.event.drag drag] is first moved onto this
	 * drop element.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second and a
	 * [jQuery.Drop] as the third parameter.
	 * This event can be used to highlight the element when a drag is moved over it:
	 *
	 *      $('.droparea').on('dropover', function(ev, drop, drag) {
	 *          $(this).addClass('highlight');
	 *      });
	 */
	"dropover",
	/**
	 * @attribute dropon
	 * @parent jQuery.event.drop
	 * 
	 * `dropon` is triggered when a drag is dropped on a drop element.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second and a
	 * [jQuery.Drop] as the third parameter.
	 *
	 *      $('.droparea').on('dropon', function(ev, drop, drag) {
	 *          $(this).html('Dropped: ' + drag.element.text());
	 *      });
	 */
	"dropon",
	/**
	 * @attribute dropout
	 * @parent jQuery.event.drop
	 * 
	 * `dropout` is called when a drag is moved out of this drop element.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second and a
	 * [jQuery.Drop] as the third parameter.
	 *
	 *      $('.droparea').on('dropover', function(ev, drop, drag) {
	 *          // Remove the drop element highlight
	 *          $(this).removeClass('highlight');
	 *      });
	 */
	"dropout",
	/**
	 * @attribute dropinit
	 * @parent jQuery.event.drop
	 * 
	 * `dropinit` is called when a drag motion starts and the drop elements are initialized.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second and a
	 * [jQuery.Drop] as the third parameter.
	 * Calling [jQuery.Drop.prototype.cancel drop.cancel()] prevents the element from
	 * being dropped on:
	 *
	 *      $('.droparea').on('dropover', function(ev, drop, drag) {
	 *          if(drag.element.hasClass('not-me')) {
	 *            drop.cancel();
	 *          }
	 *      });
	 */
	"dropinit",
	/**
	 * @attribute dropmove
	 * @parent jQuery.event.drop
	 * 
	 * `dropmove` is triggered repeatedly when a drag is moved over a drop
	 * (similar to a mousemove).
	 * The event handler gets an instance of [jQuery.Drag] passed as the second and a
	 * [jQuery.Drop] as the third parameter.
	 *
	 *      $('.droparea').on('dropmove', function(ev, drop, drag) {
	 *          $(this).html(drag.location.x() + '/' + drag.location.y());
	 *      });
	 */
	"dropmove",
	/**
	 * @attribute dropend
	 * @parent jQuery.event.drop
	 * 
	 * `dropend` is called when the drag motion is done for this drop element.
	 * The event handler gets an instance of [jQuery.Drag] passed as the second and a
	 * [jQuery.Drop] as the third parameter.
	 *
	 *
	 *      $('.droparea').on('dropend', function(ev, drop, drag) {
	 *          // Remove the drop element highlight
	 *          $(this).removeClass('highlight');
	 *      });
	 */
	"dropend"];
	
	/**
	 * @class jQuery.Drop
	 * @parent jQuery.event.drop
	 * @plugin jquery/event/drop
	 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/event/drop/drop.js
	 * @test jquery/event/drag/qunit.html
	 *
	 * The `jQuery.Drop` constructor is never called directly but an instance is passed to the
	 * to the `dropinit`, `dropover`, `dropmove`, `dropon`, and `dropend` event handlers as the
	 * third argument (the second will be the [jQuery.Drag]):
	 *
	 *      $('#dropper').on('dropover', function(el, drop, drag) {
	 *          // drop -> $.Drop
	 *          // drag -> $.Drag
	 *      });
	 */
	$.Drop = function(callbacks, element){
		jQuery.extend(this,callbacks);
		this.element = $(element);
	}
	// add the elements ...
	$.each(eventNames, function(){
			event.special[this] = {
				add: function( handleObj ) {
					//add this element to the compiles list
					var el = $(this), current = (el.data("dropEventCount") || 0);
					el.data("dropEventCount",  current+1   )
					if(current==0){
						$.Drop.addElement(this);
					}
				},
				remove: function() {
					var el = $(this), current = (el.data("dropEventCount") || 0);
					el.data("dropEventCount",  current-1   )
					if(current<=1){
						$.Drop.removeElement(this);
					}
				}
			}
	});
	
	$.extend($.Drop,{
		/**
		 * @static
		 */
		lowerName: "drop",
		_rootElements: [], //elements that are listening for drops
		_elements: $(),    //elements that can be dropped on
		last_active: [],
		endName: "dropon",
		// adds an element as a 'root' element
		// this element might have events that we need to respond to
		addElement: function( el ) {
			//check other elements
			for(var i =0; i < this._rootElements.length ; i++  ){
				if(el ==this._rootElements[i]) return;
			}
			this._rootElements.push(el);
		},
		removeElement: function( el ) {
			 for(var i =0; i < this._rootElements.length ; i++  ){
				if(el == this._rootElements[i]){
					this._rootElements.splice(i,1)
					return;
				}
			}
		},
		/**
		* @hide
		* For a list of affected drops, sorts them by which is deepest in the DOM first.
		*/ 
		sortByDeepestChild: function( a, b ) {
			var compare = a.element.compare(b.element);
			if(compare & 16 || compare & 4) return 1;
			if(compare & 8 || compare & 2) return -1;
			return 0;
		},
		/**
		 * @hide
		 * Tests if a drop is within the point.
		 */
		isAffected: function( point, moveable, responder ) {
			return ((responder.element != moveable.element) && (responder.element.within(point[0], point[1], responder._cache).length == 1));
		},
		/**
		 * @hide
		 * Calls dropout and sets last active to null
		 * @param {Object} drop
		 * @param {Object} drag
		 * @param {Object} event
		 */
		deactivate: function( responder, mover, event ) {
			mover.out(event, responder)
			responder.callHandlers(this.lowerName+'out',responder.element[0], event, mover)
		}, 
		/**
		 * @hide
		 * Calls dropover
		 * @param {Object} drop
		 * @param {Object} drag
		 * @param {Object} event
		 */
		activate: function( responder, mover, event ) { //this is where we should call over
			mover.over(event, responder)
			//this.last_active = responder;
			responder.callHandlers(this.lowerName+'over',responder.element[0], event, mover);
		},
		move: function( responder, mover, event ) {
			responder.callHandlers(this.lowerName+'move',responder.element[0], event, mover)
		},
		/**
		 * `$.Drop.compile()` gets all elements that are droppable and adds them to a list.
		 * 
		 * This should be called if and when new drops are added to the page
		 * during the motion of a single drag.
		 * 
		 * This is called by default when a drag motion starts.
		 * 
		 * ## Use
		 * 
		 * After adding an element or drop, call compile.
		 * 
		 *      $("#midpoint").bind("dropover",function(){
		 * 		    // when a drop hovers over midpoint,
		 *          // make drop a drop.
		 * 		    $("#drop").bind("dropover", function(){
		 * 			
		 * 		    });
		 * 		    $.Drop.compile();
		 * 	    });
		 */
		compile: function( event, drag ) {
			// if we called compile w/o a current drag
			if(!this.dragging && !drag){
				return;
			}else if(!this.dragging){
				this.dragging = drag;
				this.last_active = [];
				//this._elements = $();
			}
			var el, 
				drops, 
				selector, 
				dropResponders, 
				newEls = [],
				dragging = this.dragging;
			
			// go to each root element and look for drop elements
			for(var i=0; i < this._rootElements.length; i++){ //for each element
				el = this._rootElements[i]
				
				// gets something like {"": ["dropinit"], ".foo" : ["dropover","dropmove"] }
				var drops = $.event.findBySelector(el, eventNames)

				// get drop elements by selector
				for(selector in drops){ 
					
					
					dropResponders = selector ? jQuery(selector, el) : [el];
					
					// for each drop element
					for(var e= 0; e < dropResponders.length; e++){ 
						
						// add the callbacks to the element's Data
						// there already might be data, so we merge it
						if( this.addCallbacks(dropResponders[e], drops[selector], dragging) ){
							newEls.push(dropResponders[e])
						};
					}
				}
			}
			// once all callbacks are added, call init on everything ...
			// todo ... init could be called more than once?
			this.add(newEls, event, dragging)
		},
		// adds the drag callbacks object to the element or merges other callbacks ...
		// returns true or false if the element is new ...
		// onlyNew lets only new elements add themselves
		addCallbacks : function(el, callbacks, onlyNew){
			
			var origData = $.data(el,"_dropData");
			if(!origData){
				$.data(el,"_dropData", new $.Drop(callbacks, el));
				//this._elements.push(el);
				return true;
			}else if(!onlyNew){
				var origCbs = origData;
				// merge data
				for(var eventName in callbacks){
					origCbs[eventName] = origCbs[eventName] ?
							origCbs[eventName].concat(callbacks[eventName]) :
							callbacks[eventName];
				}
				return false;
			}
		},
		// calls init on each element's drags. 
		// if its cancelled it's removed
		// adds to the current elements ...
		add: function( newEls, event, drag , dragging) {
			var i = 0,
				drop;
			
			while(i < newEls.length){
				drop = $.data(newEls[i],"_dropData");
				drop.callHandlers(this.lowerName+'init', newEls[i], event, drag)
				if(drop._canceled){
					newEls.splice(i,1)
				}else{
					i++;
				}
			}
			this._elements.push.apply(this._elements, newEls)
		},
		show: function( point, moveable, event ) {
			var element = moveable.element;
			if(!this._elements.length) return;
			
			var respondable, 
				affected = [], 
				propagate = true, 
				i = 0, 
				j, 
				la, 
				toBeActivated, 
				aff, 
				oldLastActive = this.last_active,
				responders = [],
				self = this,
				drag;
				
			//what's still affected ... we can also move element out here
			while( i < this._elements.length){
				drag = $.data(this._elements[i],"_dropData");
				
				if (!drag) {
					this._elements.splice(i, 1)
				}
				else {
					i++;
					if (self.isAffected(point, moveable, drag)) {
						affected.push(drag);
					}
				}
			}
			

			
			affected.sort(this.sortByDeepestChild); //we should only trigger on lowest children
			event.stopRespondPropagate = function(){
				propagate = false;
			}
			
			toBeActivated = affected.slice();

			// all these will be active
			this.last_active = affected;
			
			//deactivate everything in last_active that isn't active
			for (j = 0; j < oldLastActive.length; j++) {
				la = oldLastActive[j];
				i = 0;
				while((aff = toBeActivated[i])){
					if(la == aff){
						toBeActivated.splice(i,1);break;
					}else{
						i++;
					}
				}
				if(!aff){
					this.deactivate(la, moveable, event);
				}
				if(!propagate) return;
			}
			for(var i =0; i < toBeActivated.length; i++){
				this.activate(toBeActivated[i], moveable, event);
				if(!propagate) return;
			}
			//activate everything in affected that isn't in last_active
			
			for (i = 0; i < affected.length; i++) {
				this.move(affected[i], moveable, event);
				
				if(!propagate) return;
			}
		},
		end: function( event, moveable ) {
			var responder, la, 
				endName = this.lowerName+'end',
				dropData;
			
			// call dropon
			//go through the actives ... if you are over one, call dropped on it
			for(var i = 0; i < this.last_active.length; i++){
				la = this.last_active[i]
				if( this.isAffected(event.vector(), moveable, la)  && la[this.endName]){
					la.callHandlers(this.endName, null, event, moveable);
				}
			}
			// call dropend
			for(var r =0; r<this._elements.length; r++){
				dropData = $.data(this._elements[r],"_dropData");
				dropData && dropData.callHandlers(endName, null, event, moveable);
			}

			this.clear();
		},
		/**
		 * Called after dragging has stopped.
		 * @hide
		 */
		clear: function() {
		  this._elements.each(function(){
		  	$.removeData(this,"_dropData")
		  })
		  this._elements = $();
		  delete this.dragging;
		  //this._responders = [];
		}
	})
	$.Drag.responder = $.Drop;
	
	$.extend($.Drop.prototype,{
		/**
		 * @prototype
		 */
		callHandlers: function( method, el, ev, drag ) {
			var length = this[method] ? this[method].length : 0
			for(var i =0; i < length; i++){
				this[method][i].call(el || this.element[0], ev, this, drag)
			}
		},
		/**
		 * `drop.cache(value)` sets the drop to cache positions of draggable elements.
		 * This should be called on `dropinit`. For example:
		 *
		 *      $('#dropable').on('dropinit', function( el, ev, drop ) {
		 *          drop.cache();
		 *      });
		 *
		 * @param {Boolean} [value=true] Whether to cache drop elements or not.
		 */
		cache: function( value ) {
			this._cache = value != null ? value : true;
		},
		/**
		 * `drop.cancel()` prevents this drop from being dropped on.
		 *
		 *      $('.droparea').on('dropover', function(ev, drop, drag) {
		 *          if(drag.element.hasClass('not-me')) {
		 *            drop.cancel();
		 *          }
		 *      });
		 */
		cancel: function() {
			this._canceled = true;
		}
	} )
})(jQuery);
(function($){ //needs drop to determine if respondable

/**
 * @add jQuery.Drag.prototype
 */
$.Drag.prototype.
	/**
	 * @plugin jquery/event/drag/scroll
	 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/event/drag/scroll/scroll.js
	 * 
	 * `drag.scrolls(elements, [options])` scroll elements with 
	 * a scroll bar as the drag moves to borders.
	 * 
	 * The following sets up the drag motions to scroll `#todos` and the window.  Scrolling will
	 * start 50px away from a boundary and the speed will increase to 50px of scroll every 15ms.
	 * 
	 *     $('#todos').on(".todo","draginit", function(ev, drag){
	 *       drag.scrolls($('#todos').add(window), {
	 *         distance : 50,
	 *         delta : function(diff) { return (50 - diff) / 2},
	 *         direction : "y"
	 *       })
	 *     })
	 * 
	 * @param {jQuery} elements an array of elements to scroll.  The window can be in this array.
	 * @param {Object} [options] changes the default settings.
	 * 
	 *   - `distance` {number} 30 - how many pixels away from a boundry where we start scrolling
	 *   - `delta(diff)` {Function} - returns how far we should scroll.  It is passed how many pixels the cursor is
	 *     from the boundry.
	 *   - `direction` {String} - direction scrolling should happen.  "xy" is the default.
	 */
	scrolls = function(elements, options){
		var elements = $(elements);
		
		for(var i = 0 ; i < elements.length; i++){
			this.constructor.responder._elements.push( elements.eq(i).data("_dropData", new $.Scrollable(elements[i], options) )[0] )
		}
	},
	
$.Scrollable = function(element, options){
	this.element = jQuery(element);
	this.options = $.extend({
		// when  we should start scrolling
		distance : 30,
		// how far we should move
		delta : function(diff, distance){
			return (distance - diff) / 2;
		},
		direction: "xy"
	}, options);
	this.x = this.options.direction.indexOf("x") != -1;
	this.y = this.options.direction.indexOf("y") != -1;
}
$.extend($.Scrollable.prototype,{
	init: function( element ) {
		this.element = jQuery(element);
	},
	callHandlers: function( method, el, ev, drag ) {
		this[method](el || this.element[0], ev, this, drag)
	},
	dropover: function() {
		
	},
	dropon: function() {
		this.clear_timeout();
	}, 
	dropout: function() {
		this.clear_timeout();
	},
	dropinit: function() {
		
	},
	dropend: function() {},
	clear_timeout: function() {
		if(this.interval){
			clearTimeout(this.interval)
			this.interval = null;
		}
	},
	distance: function( diff ) {
		return (30 - diff) / 2;
	},
	dropmove: function( el, ev, drop, drag ) {
		
		//if we were about to call a move, clear it.
		this.clear_timeout();
		
		//position of the mouse
		var mouse = ev.vector(),
		
		//get the object we are going to get the boundries of
			location_object = $(el == document.documentElement ? window : el),
		
		//get the dimension and location of that object
			dimensions = location_object.dimensionsv('outer'),
			position = location_object.offsetv(),
		
		//how close our mouse is to the boundries
			bottom = position.y()+dimensions.y() - mouse.y(),
			top = mouse.y() - position.y(),
			right = position.x()+dimensions.x() - mouse.x(),
			left = mouse.x() - position.x(),
		
		//how far we should scroll
			dx =0, dy =0,
			distance =  this.options.distance;

		//check if we should scroll
		if(bottom < distance && this.y)
			dy = this.options.delta(bottom,distance);
		else if(top < distance && this.y)
			dy = -this.options.delta(top,distance)
		if(right < distance && this.options && this.x)
			dx = this.options.delta(right,distance);
		else if(left < distance && this.x)
			dx = -this.options.delta(left,distance);
		
		//if we should scroll
		if(dx || dy){
			//set a timeout that will create a mousemove on that object
			var self = this;
			this.interval =  setTimeout( function(){
				self.move($(el), drag.movingElement, dx, dy, ev, ev.clientX, ev.clientY, ev.screenX, ev.screenY)
			},15)
		}
	},
	/**
	 * Scrolls an element then calls mouse a mousemove in the same location.
	 * @hide
	 */
	move: function( scroll_element, drag_element, dx, dy, ev/*, x,y,sx, sy*/ ) {
		scroll_element.scrollTop( scroll_element.scrollTop() + dy);
		scroll_element.scrollLeft(scroll_element.scrollLeft() + dx);
		
		drag_element.trigger(
			$.event.fix({type: "mousemove", 
					 clientX: ev.clientX, 
					 clientY: ev.clientY, 
					 screenX: ev.screenX, 
					 screenY: ev.screenY,
					 pageX:   ev.pageX,
					 pageY:   ev.pageY}))
		//drag_element.synthetic('mousemove',{clientX: x, clientY: y, screenX: sx, screenY: sy})
	}
})

})(jQuery);
(function( $ ) {
	var round = function( x, m ) {
		return Math.round(x / m) * m;
	}

	$.Drag.prototype.
	/**
	 * @function step
	 * @plugin jquery/event/drag/step
	 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/event/drag/step/step.js
	 * makes the drag move in steps of amount pixels.
	 * 
	 *     drag.step({x: 5}, $('foo'), "xy")
	 * 
	 * ## Demo
	 * 
	 * @demo jquery/event/drag/step/step.html
	 * 
	 * @param {number|Object} amount make the drag move the amount in pixels from the top-left of container.
	 * 
	 * If the amount is a `number`, the drag will move step-wise that number pixels in both 
	 * dimensions.  If it's an object like `{x: 20, y: 10}` the drag will move in steps 20px from
	 * left to right and 10px up and down.
	 * 
	 * @param {jQuery} [container] the container to move in reference to.  If not provided, the document is used.
	 * @param {String} [center] Indicates how to position the drag element in relationship to the container.
	 * 
	 *   -  If nothing is provided, places the top left corner of the drag element at
	 *      'amount' intervals from the top left corner of the container.  
	 *   -  If 'x' is provided, it centers the element horizontally on the top-left corner.
	 *   -  If 'y' is provided, it centers the element vertically on the top-left corner of the container.
	 *   -  If 'xy' is provided, it centers the element on the top-left corner of the container.
	 *   
	 * @return {jQuery.Drag} the drag object for chaining.
	 */
	step = function( amount, container, center ) {
		//on draws ... make sure this happens
		if ( typeof amount == 'number' ) {
			amount = {
				x: amount,
				y: amount
			}
		}
		container = container || $(document.body);
		this._step = amount;

		var styles = container.styles("borderTopWidth", "paddingTop", "borderLeftWidth", "paddingLeft");
		var top = parseInt(styles.borderTopWidth) + parseInt(styles.paddingTop),
			left = parseInt(styles.borderLeftWidth) + parseInt(styles.paddingLeft);

		this._step.offset = container.offsetv().plus(left, top);
		this._step.center = center;
		return this;
	};


	var oldPosition = $.Drag.prototype.position;
	$.Drag.prototype.position = function( offsetPositionv ) {
		//adjust required_css_position accordingly
		if ( this._step ) {
			var step = this._step,
				center = step.center && step.center.toLowerCase(),
				movingSize = this.movingElement.dimensionsv('outer'),
				lot = step.offset.top()- (center && center != 'x' ? movingSize.height() / 2 : 0),
				lof = step.offset.left() - (center && center != 'y' ? movingSize.width() / 2 : 0);

			if ( this._step.x ) {
				offsetPositionv.left(Math.round(lof + round(offsetPositionv.left() - lof, this._step.x)))
			}
			if ( this._step.y ) {
				offsetPositionv.top(Math.round(lot + round(offsetPositionv.top() - lot, this._step.y)))
			}
		}

		oldPosition.call(this, offsetPositionv)
	}

})(jQuery);
(function () {
	// http://bitovi.com/blog/2012/04/faster-jquery-event-fix.html
	// https://gist.github.com/2377196

	// IE 8 has Object.defineProperty but it only defines DOM Nodes. According to
	// http://kangax.github.com/es5-compat-table/#define-property-ie-note
	// All browser that have Object.defineProperties also support Object.defineProperty properly
	if(Object.defineProperties) {
		var
			// Use defineProperty on an object to set the value and return it
			set = function (obj, prop, val) {
				if(val !== undefined) {
					Object.defineProperty(obj, prop, {
						value : val
					});
				}
				return val;
			},
			// special converters
			special = {
				pageX : function (original) {
					var eventDoc = this.target.ownerDocument || document;
					doc = eventDoc.documentElement;
					body = eventDoc.body;
					return original.clientX + ( doc && doc.scrollLeft || body && body.scrollLeft || 0 ) - ( doc && doc.clientLeft || body && body.clientLeft || 0 );
				},
				pageY : function (original) {
					var eventDoc = this.target.ownerDocument || document;
					doc = eventDoc.documentElement;
					body = eventDoc.body;
					return original.clientY + ( doc && doc.scrollTop || body && body.scrollTop || 0 ) - ( doc && doc.clientTop || body && body.clientTop || 0 );
				},
				relatedTarget : function (original) {
					if(!original) {
						return;
					}
					return original.fromElement === this.target ? original.toElement : original.fromElement;
				},
				metaKey : function (originalEvent) {
					return originalEvent.ctrlKey;
				},
				which : function (original) {
					return original.charCode != null ? original.charCode : original.keyCode;
				}
			};

		// Get all properties that should be mapped
		jQuery.each(jQuery.event.keyHooks.props.concat(jQuery.event.mouseHooks.props).concat(jQuery.event.props), function (i, prop) {
			if (prop !== "target") {
				(function () {
					Object.defineProperty(jQuery.Event.prototype, prop, {
						get : function () {
							// get the original value, undefined when there is no original event
							var originalValue = this.originalEvent && this.originalEvent[prop];
							// overwrite getter lookup
							return this['_' + prop] !== undefined ? this['_' + prop] : set(this, prop,
								// if we have a special function and no value
								special[prop] && originalValue === undefined ?
									// call the special function
									special[prop].call(this, this.originalEvent) :
									// use the original value
									originalValue)
						},
						set : function (newValue) {
							// Set the property with underscore prefix
							this['_' + prop] = newValue;
						}
					});
				})();
			}
		});

		jQuery.event.fix = function (event) {
			if (event[ jQuery.expando ]) {
				return event;
			}
			// Create a jQuery event with at minimum a target and type set
			var originalEvent = event,
				event = jQuery.Event(originalEvent);
			event.target = originalEvent.target;
			// Fix target property, if necessary (#1925, IE 6/7/8 & Safari2)
			if (!event.target) {
				event.target = originalEvent.srcElement || document;
			}

			// Target should not be a text node (#504, Safari)
			if (event.target.nodeType === 3) {
				event.target = event.target.parentNode;
			}

			return event;
		}
	}
})(jQuery);
(function($){
/**
 * @class jQuery.Hover
 * @plugin jquery/event/hover
 * @download  http://jmvcsite.heroku.com/pluginify?plugins[]=jquery/event/hover/hover.js
 * @parent jQuery.event.hover
 *
 * Creates a new hover. The constructor should not be called directly.
 *
 * An instance of `$.Hover` is passed as the second argument to each
 * [jQuery.event.hover] event handler:
 *
 *      $('#menu').on("hoverinit", function(ev, hover) {
 *          // Set the hover distance to 20px
 *          hover.distance(20);
 *      });
 */
$.Hover = function(){
	this._delay =  $.Hover.delay;
	this._distance = $.Hover.distance;
	this._leave = $.Hover.leave
};
/**
 * @Static
 */
$.extend($.Hover,{
	/**
	 * @attribute delay
	 *
	 * `$.Hover.delay` is the delay (in milliseconds) after which the hover is
	 * activated by default.
	 *
	 * Set this value as a global default. The default is 100ms.
	 *
	 *      // Set the global hover delay to 1 second
	 *      $.Hover.delay = 1000;
	 */
	delay: 100,
	/**
	 * @attribute distance
	 *
	 * `$.Hover.distance` is the maximum distance (in pixels) that the mouse is allowed to
	 * travel within the time of [jQuery.Hover.delay] in order to activate a hover.
	 *
	 * Set this value as a global default. The default is 10px.
	 *
	 *      // Set the global hover distance to 1 pixel
	 *      $.Hover.distance = 1;
	 */
	distance: 10,
	leave : 0
})

/**
 * @Prototype
 */
$.extend($.Hover.prototype,{
	/**
	 * `hover.delay(time)` sets the delay (in ms) for this hover.
	 * This method should only be used in [jQuery.event.hover.hoverinit hoverinit]:
	 *
	 *      $('.hoverable').on('hoverinit', function(ev, hover) {
	 *          // Set the delay to 500ms
	 *          hover.delay(500);
	 *      });
	 *
	 * @param {Number} delay the number of milliseconds used to determine a hover
	 * @return {$.Hover} The hover object
	 */
	delay: function( delay ) {
		this._delay = delay;
		return this;
	},
	/**
	 * `hover.distance(px) sets the maximum distance (in pixels) the mouse is allowed to travel in order to activate
	 * the hover. This method should only be used in [jQuery.event.hover.hoverinit hoverinit]:
	 *
	 *      $('.hoverable').on('hoverinit', function(ev, hover) {
	 *          // Set the distance to 1px
	 *          hover.distance(1);
	 *      });
	 *
	 * @param {Number} distance the max distance in pixels a mouse can move to be considered a hover
	 * @return {$.Hover} The hover object
	 */
	distance: function( distance ) {
		this._distance = distance;
		return this;
	},
	/**
	 * `hover.leave(delay)` sets a delay for how long the hover should stay active after the mouse left.
	 * This method should only be used in [jQuery.event.hover.hoverinit hoverinit]:
	 *
	 *      $('.hoverable').on('hoverinit', function(ev, hover) {
	 *          // Stay active for another second after the mouse left
	 *          hover.leave(1000);
	 *      });
	 *
	 * @param {Number} delay the number of milliseconds the hover should stay active after the mouse leaves
	 * @return {$.Hover} The hover object
	 */
	leave : function(leave){
		this._leave = leave;
		return this;
	}
})
var event = $.event, 
	handle  = event.handle,
	onmouseenter = function(ev){
		//now start checking mousemoves to update location
		var delegate = ev.delegateTarget || ev.currentTarget;
		var selector = ev.handleObj.selector;
		//prevents another mouseenter until current has run its course
		if($.data(delegate,"_hover"+selector)){
			return;
		}
		$.data(delegate,"_hover"+selector, true)
		var loc = {
				pageX : ev.pageX,
				pageY : ev.pageY
			}, 
			dist = 0, 
			timer, 
			enteredEl = this, 
			hovered = false,
			lastEv = ev, 
			hover = new $.Hover(),
			leaveTimer,
			callHoverLeave = function(){
				$.each(event.find(delegate, ["hoverleave"], selector), function(){
					this.call(enteredEl, ev, hover)
				})
				cleanUp();
			},
			mouseenter = function(ev){
				clearTimeout(leaveTimer);
				dist += Math.pow( ev.pageX-loc.pageX, 2 ) + Math.pow( ev.pageY-loc.pageY, 2 ); 
				loc = {
					pageX : ev.pageX,
					pageY : ev.pageY
				}
				lastEv = ev
			},
			mouseleave = function(ev){
				clearTimeout(timer);
				// go right away
				if(hovered){
					if(hover._leave === 0){
						callHoverLeave();
					}else{
						clearTimeout(leaveTimer);
						leaveTimer = setTimeout(function(){
							callHoverLeave();
						}, hover._leave)
					}
				}else{
					cleanUp();
				}
			},
			cleanUp = function(){
				$(enteredEl).unbind("mouseleave",mouseleave)
				$(enteredEl).unbind("mousemove",mouseenter);
				$.removeData(delegate,"_hover"+selector)
			};
		
		$(enteredEl).bind("mousemove",mouseenter).bind("mouseleave", mouseleave);
		$.each(event.find(delegate, ["hoverinit"], selector), function(){
			this.call(enteredEl, ev, hover)
		})
		
		timer = setTimeout(function(){
			//check that we aren't moveing around
			if(dist < hover._distance && $(enteredEl).queue().length == 0){
				$.each(event.find(delegate, ["hoverenter"], selector), function(){
					this.call(enteredEl, lastEv, hover)
				})
				hovered = true;
				return;
			}else{
				dist = 0;
				timer = setTimeout(arguments.callee, hover._delay)
			}
		}, hover._delay)
		
	};

/**
 * @add jQuery.event.special
 */
event.setupHelper( [
/**
 * @attribute hoverinit
 * @parent jQuery.event.hover
 *
 * `hoverinit` is called when a hover is about to start (on `mouseenter`). Listen for `hoverinit` events to configure
 * [jQuery.Hover::delay delay] and [jQuery.Hover::distance distance]
 * for this specific event:
 *
 *      $(".option").on("hoverinit", function(ev, hover){
 *          //set the distance to 10px
 *          hover.distance(10);
 *          //set the delay to 200ms
 *          hover.delay(10);
 *          // End the hover one second after the mouse leaves
 *          hover.leave(1000);
 *      })
 */
"hoverinit", 
/**
 * @attribute hoverenter
 * @parent jQuery.event.hover
 *
 * `hoverenter` events are called when the mouses less than [jQuery.Hover.prototype.distance] pixels in
 * [jQuery.Hover.prototype.delay delay] milliseconds.
 *
 *      $(".option").on("hoverenter", function(ev, hover){
 *          $(this).addClass("hovering");
 *      })
 */
"hoverenter",
/**
 * @attribute hoverleave
 * @parent jQuery.event.hover
 *
 * `hoverleave` is called when the mouse leaves an element that has been hovered.
 *
 *      $(".option").on("hoverleave", function(ev, hover){
 *          $(this).removeClass("hovering");
 *      })
 */
"hoverleave",
/**
 * @attribute hovermove
 * @parent jQuery.event.hover
 *
 * `hovermove` is called when a `mousemove` occurs on an element that has been hovered.
 *
 *      $(".option").on("hovermove", function(ev, hover){
 *          // not sure why you would want to listen for this
 *          // but we provide it just in case
 *      })
 */
"hovermove"], "mouseenter", onmouseenter )
		

	
})(jQuery);
(function($){
	var keymap = {},
		reverseKeyMap = {};
		
	/**
	 * @hide
	 * @parent jQuery.Event.prototype.key
	 * 
	 * Allows you to set alternate key maps or overwrite existing key codes.
	 * For example::
	 * 
	 *     $.event.key({"~" : 177});
	 * 
	 * @param {Object} map A map of character - keycode pairs.
	 */
	$.event.key = function(map){
		$.extend(keymap, map);
		for(var name in map){
			reverseKeyMap[map[name]] = name;
		}
	};
	
	$.event.key({
		//backspace
		'\b':'8',
		
		//tab
		'\t':'9',
		
		//enter
		'\r':'13',
		
		//special
		'shift':'16','ctrl':'17','alt':'18',
		
		//weird
		'pause-break':'19',
		'caps':'20',
		'escape':'27',
		'num-lock':'144',
		'scroll-lock':'145',
		'print' : '44',
		
		//navigation
		'page-up':'33','page-down':'34','end':'35','home':'36',
		'left':'37','up':'38','right':'39','down':'40','insert':'45','delete':'46',
		
		//normal characters
		' ':'32',
		'0':'48','1':'49','2':'50','3':'51','4':'52','5':'53','6':'54','7':'55','8':'56','9':'57',
		'a':'65','b':'66','c':'67','d':'68','e':'69','f':'70','g':'71','h':'72','i':'73','j':'74','k':'75','l':'76','m':'77',
		'n':'78','o':'79','p':'80','q':'81','r':'82','s':'83','t':'84','u':'85','v':'86','w':'87','x':'88','y':'89','z':'90',
		//normal-characters, numpad
		'num0':'96','num1':'97','num2':'98','num3':'99','num4':'100','num5':'101','num6':'102','num7':'103','num8':'104','num9':'105',
		'*':'106','+':'107','-':'109','.':'110',
		//normal-characters, others
		'/':'111',
		';':'186',
		'=':'187',
		',':'188',
		'-':'189',
		'.':'190',
		'/':'191',
		'`':'192',
		'[':'219',
		'\\':'220',
		']':'221',
		"'":'222',
		
		//ignore these, you shouldn't use them
		'left window key':'91','right window key':'92','select key':'93',
		
		
		'f1':'112','f2':'113','f3':'114','f4':'115','f5':'116','f6':'117',
		'f7':'118','f8':'119','f9':'120','f10':'121','f11':'122','f12':'123'
	});
	
	/**
	 * @parent jQuery.event.key
	 * @plugin jquery/event/key
	 * @function jQuery.Event.prototype.keyName
	 *
	 * Returns a string representation of the key pressed:
	 *
	 *      $("input").on('keypress', function(ev){
	 *          if(ev.keyName() == 'ctrl') {
	 *              $(this).addClass('highlight');
	 *          }
	 *      });
	 *
	 * The key names mapped by default can be found in the [jQuery.event.key jQuery.event.key overview].
	 *
	 * @return {String} The string representation of of the key pressed.
	 */
	jQuery.Event.prototype.keyName  = function(){
		var event = this,
			keycode,
			test = /\w/;
	
		var key_Key =   reverseKeyMap[(event.keyCode || event.which)+""],
			char_Key =  String.fromCharCode(event.keyCode || event.which),
			key_Char =  event.charCode && reverseKeyMap[event.charCode+""],
			char_Char = event.charCode && String.fromCharCode(event.charCode);
		
		if( char_Char && test.test(char_Char) ) {
			return char_Char.toLowerCase()
		}
		if( key_Char && test.test(key_Char) ) {
			return char_Char.toLowerCase()
		}
		if( char_Key && test.test(char_Key) ) {
			return char_Key.toLowerCase()
		}
		if( key_Key && test.test(key_Key) ) {
			return key_Key.toLowerCase()
		}

		if (event.type == 'keypress'){
			return event.keyCode ? String.fromCharCode(event.keyCode) : String.fromCharCode(event.which)
		}

		if (!event.keyCode && event.which) {
			return String.fromCharCode(event.which)
		}

		return reverseKeyMap[event.keyCode+""] 
	}
	
	
})(jQuery);
(function($){


var current,
	rnamespaces = /\.(.*)$/,
	returnFalse = function(){return false},
	returnTrue = function(){return true};

$.Event.prototype.isPaused = returnFalse

/**
 * @function jQuery.Event.prototype.pause
 * @parent jQuery.event.pause
 *
 * `event.paused()` pauses an event (to be resumed later):
 *
 *      $('.tab').on('show', function(ev) {
 *          ev.pause();
 *          // Resume the event after 1 second
 *          setTimeout(function() {
 *              ev.resume();
 *          }, 1000);
 *      });
 */
$.Event.prototype.pause = function(){
	// stop the event from continuing temporarily
	// keep the current state of the event ...
	this.pausedState = {
		isDefaultPrevented : this.isDefaultPrevented() ?
			returnTrue : returnFalse,
		isPropagationStopped : this.isPropagationStopped() ?
			returnTrue : returnFalse
	};
	
	this.stopImmediatePropagation();
	this.preventDefault();
	this.isPaused = returnTrue;
};

/**
 * @function jQuery.Event.prototype.resume
 * @parent jQuery.event.pause
 *
 * `event.resume()` resumes a paused event:
 *
 *      $('.tab').on('show', function(ev) {
 *          ev.pause();
 *          // Resume the event after 1 second
 *          setTimeout(function() {
 *              ev.resume();
 *          }, 1000);
 *      });
 */
$.Event.prototype.resume = function(){
	// temporarily remove all event handlers of this type 
	var handleObj = this.handleObj,
		currentTarget = this.currentTarget;
	// temporarily overwrite special handle
	var origType = jQuery.event.special[ handleObj.origType ],
		origHandle = origType && origType.handle;
		
	if(!origType){
		jQuery.event.special[ handleObj.origType ] = {};
	}
	jQuery.event.special[ handleObj.origType ].handle = function(ev){
		// remove this once we have passed the handleObj
		if(ev.handleObj === handleObj && ev.currentTarget === currentTarget){
			if(!origType){
				delete jQuery.event.special[ handleObj.origType ];
			} else {
				jQuery.event.special[ handleObj.origType ].handle = origHandle;
			}
		}
	}
	delete this.pausedState;
	// reset stuff
	this.isPaused = this.isImmediatePropagationStopped = returnFalse;
	
	
	// re-run dispatch
	//$.event.dispatch.call(currentTarget, this)
	
	// with the events removed, dispatch
	
	if(!this.isPropagationStopped()){
		// fire the event again, no events will get fired until
		// same currentTarget / handler
		$.event.trigger(this, [], this.target);
	}
	
};

/*var oldDispatch = $.event.dispatch;
$.event.dispatch = function(){
	
}*/
// we need to finish handling

// and then trigger on next element ...
// can we fake the target ?


})(jQuery);
(function( $ ) {
	var resizers = $(),
		resizeCount = 0,
		// bind on the window window resizes to happen
		win = $(window),
		windowWidth = 0,
		windowHeight = 0,
		timer;

	$(function() {
		windowWidth = win.width();
		windowHeight = win.height();
	})

	/**
	 * @attribute resize
	 */
	$.event.special.resize = {
		setup: function( handleObj ) {
			// add and sort the resizers array
			// don't add window because it can't be compared easily
			if ( this !== window ) {
				resizers.push(this);
				$.unique(resizers);
			}
			// returns false if the window
			return this !== window;
		},
		teardown: function() {
			// we shouldn't have to sort
			resizers = resizers.not(this);

			// returns false if the window
			return this !== window;
		},
		add: function( handleObj ) {
			// increment the number of resizer elements
			//$.data(this, "jquery.dom.resizers", ++$.data(this, "jquery.dom.resizers") );
			var origHandler = handleObj.handler;
			handleObj.origHandler = origHandler;

			handleObj.handler = function( ev, data ) {
				var isWindow = this === window;

				// if we are the window and a real resize has happened
				// then we check if the dimensions actually changed
				// if they did, we will wait a brief timeout and 
				// trigger resize on the window
				// this is for IE, to prevent window resize 'infinate' loop issues
				if ( isWindow && ev.originalEvent ) {
					var width = win.width(),
						height = win.height();


					if ((width != windowWidth || height != windowHeight)) {
						//update the new dimensions
						windowWidth = width;
						windowHeight = height;
						clearTimeout(timer)
						timer = setTimeout(function() {
							win.trigger("resize");
						}, 1);

					}
					return;
				}

				// if this is the first handler for this event ...
				if ( resizeCount === 0 ) {
					// prevent others from doing what we are about to do
					resizeCount++;
					var where = data === false ? ev.target : this

					//trigger all this element's handlers
					$.event.handle.call(where, ev);
					if ( ev.isPropagationStopped() ) {
						resizeCount--;
						return;
					}

					// get all other elements within this element that listen to resize
					// and trigger their resize events
					var index = resizers.index(this),
						length = resizers.length,
						child, sub;

					// if index == -1 it's the window
					while (++index < length && (child = resizers[index]) && (isWindow || $.contains(where, child)) ) {

						// call the event
						$.event.handle.call(child, ev);

						if ( ev.isPropagationStopped() ) {
							// move index until the item is not in the current child
							while (++index < length && (sub = resizers[index]) ) {
								if (!$.contains(child, sub) ) {
									// set index back one
									index--;
									break
								}
							}
						}
					}

					// prevent others from responding
					ev.stopImmediatePropagation();
					resizeCount--;
				} else {
					handleObj.origHandler.call(this, ev, data);
				}
			}
		}
	};

	// automatically bind on these
	$([document, window]).bind('resize', function() {})
})(jQuery);
(function($){
// TODO remove this, phantom supports touch AND click, but need to make funcunit support touch so its testable
var isPhantom = /Phantom/.test(navigator.userAgent),
	supportTouch = !isPhantom && "ontouchend" in document,
	scrollEvent = "touchmove scroll",
	touchStartEvent = supportTouch ? "touchstart" : "mousedown",
	touchStopEvent = supportTouch ? "touchend" : "mouseup",
	touchMoveEvent = supportTouch ? "touchmove" : "mousemove",
	data = function(event){
		var d = event.originalEvent.touches ?
			event.originalEvent.touches[ 0 ] :
			event;
		return {
			time: (new Date).getTime(),
			coords: [ d.pageX, d.pageY ],
			origin: $( event.target )
		};
	};

/**
 * @add jQuery.event.swipe
 */
var swipe = $.event.swipe = {
	/**
	 * @attribute delay
	 * Delay is the upper limit of time the swipe motion can take in milliseconds.  This defaults to 500.
	 * 
	 * A user must perform the swipe motion in this much time.
	 */
	delay : 500,
	/**
	 * @attribute max
	 * The maximum distance the pointer must travel in pixels.  The default is 75 pixels.
	 */
	max : 75,
	/**
	 * @attribute min
	 * The minimum distance the pointer must travel in pixels.  The default is 30 pixels.
	 */
	min : 30
};

$.event.setupHelper( [

/**
 * @hide
 * @attribute swipe
 */
"swipe",
/**
 * @hide
 * @attribute swipeleft
 */
'swipeleft',
/**
 * @hide
 * @attribute swiperight
 */
'swiperight',
/**
 * @hide
 * @attribute swipeup
 */
'swipeup',
/**
 * @hide
 * @attribute swipedown
 */
'swipedown'], touchStartEvent, function(ev){
	//listen to mouseup
	var start = data(ev),
		stop,
		delegate = ev.delegateTarget || ev.currentTarget,
		selector = ev.handleObj.selector,
		entered = this;
	
	function moveHandler(event){
		if ( !start ) {
			return;
		}
		stop = data(event);

		// prevent scrolling
		if ( Math.abs( start.coords[0] - stop.coords[0] ) > 10 ) {
			event.preventDefault();
		}
	};
	$(document.documentElement).bind(touchMoveEvent,moveHandler )
		.one(touchStopEvent, function(event){
			$(this).unbind( touchMoveEvent, moveHandler );
			if ( start && stop ) {
				var deltaX = Math.abs(start.coords[0] - stop.coords[0]),
					deltaY = Math.abs(start.coords[1] - stop.coords[1]),
					distance = Math.sqrt(deltaX*deltaX+deltaY*deltaY);

				if ( stop.time - start.time < swipe.delay && distance >= swipe.min ) {
					
					var events = ['swipe']
					if( deltaX >= swipe.min &&  deltaY < swipe.min) {
						events.push( start.coords[0] > stop.coords[0] ? "swipeleft" : "swiperight" );
					}else if(deltaY >= swipe.min && deltaX < swipe.min){
						events.push( start.coords[1] < stop.coords[1] ? "swipedown" : "swipeup" );
					}

					
					
					//trigger swipe events on this guy
					$.each($.event.find(delegate, events, selector), function(){
						this.call(entered, ev, {start : start, end: stop})
					})
				
				}
			}
			start = stop = undefined;
		})
});

})(jQuery)