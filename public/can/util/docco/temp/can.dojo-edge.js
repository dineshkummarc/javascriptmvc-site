(function( can, window, undefined ) {

    can.addEvent = function( event, fn ) {
        if (!this.__bindEvents ) {
            this.__bindEvents = {};
        }
        var eventName = event.split(".")[0];

        if (!this.__bindEvents[eventName] ) {
            this.__bindEvents[eventName] = [];
        }
        this.__bindEvents[eventName].push({
            handler: fn,
            name: event
        });
        return this;
    };
    can.removeEvent = function( event, fn ) {
        if (!this.__bindEvents ) {
            return;
        }
        var i = 0,
            events = this.__bindEvents[event.split(".")[0]],
            ev;
        while ( i < events.length ) {
            ev = events[i]
            if ((fn && ev.handler === fn) || (!fn && ev.name === event)) {
                events.splice(i, 1);
            } else {
                i++;
            }
        }
        return this;
    };
    can.dispatch = function( event ) {
        if (!this.__bindEvents ) {
            return;
        }

        var eventName = event.type.split(".")[0],
            handlers = this.__bindEvents[eventName] || [],
            self = this,
            args = [event].concat(event.data || []);

        can.each(handlers, function( i, ev ) {
            event.data = args.slice(1);
            ev.handler.apply(self, args);
        });
    }

    ;

    define("plugd/trigger", ["dojo"], function( dojo ) {

        var d = dojo,
            isfn = d.isFunction,
            leaveRe = /mouse(enter|leave)/,
            _fix = function( _, p ) {
                return "mouse" + (p == "enter" ? "over" : "out");
            },
            mix = d._mixin,

            // the guts of the node triggering logic:
            // the function accepts node (not string|node), "on"-less event name,
            // and an object of args to mix into the event. 
            realTrigger = d.doc.createEvent ?
            function( n, e, a ) {
                // the sane branch
                var ev = d.doc.createEvent("HTMLEvents");
                e = e.replace(leaveRe, _fix);
                // destroyed events should not bubble
                ev.initEvent(e, e === "destroyed" ? false : true, true);
                a && mix(ev, a);
                n.dispatchEvent(ev);
            } : function( n, e, a ) {
                // the janktastic branch
                var ev = "on" + e,
                    stop = false,
                    lc = e.toLowerCase(),
                    node = n;
                try {
                    // FIXME: is this worth it? for mixed-case native event support:? Opera ends up in the
                    //    createEvent path above, and also fails on _some_ native-named events. 
                    //                    if(lc !== e && d.indexOf(d.NodeList.events, lc) >= 0){
                    //                        // if the event is one of those listed in our NodeList list
                    //                        // in lowercase form but is mixed case, throw to avoid
                    //                        // fireEvent. /me sighs. http://gist.github.com/315318
                    //                        throw("janktastic");
                    //                    }
                    n.fireEvent(ev);
                } catch (er) {
                    // a lame duck to work with. we're probably a 'custom event'
                    var evdata = mix({
                        type: e,
                        target: n,
                        faux: true,
                        // HACK: [needs] added support for customStopper to _base/event.js
                        // some tests will fail until del._stopPropagation has support.
                        _stopper: function() {
                            stop = this.cancelBubble;
                        }
                    }, a);

                    isfn(n[ev]) && n[ev](evdata);

                    // handle bubbling of custom events, unless the event was stopped.
                    while (!stop && n !== d.doc && n.parentNode ) {
                        n = n.parentNode;
                        isfn(n[ev]) && n[ev](evdata);
                    }
                }
            };

        d._trigger = function(
                node,
                event, extraArgs ) {
            // summary:
            //        Helper for `dojo.trigger`, which handles the DOM cases. We should never
            //        be here without a domNode reference and a string eventname.
            var n = d.byId(node),
                ev = event && event.slice(0, 2) == "on" ? event.slice(2) : event;
            realTrigger(n, ev, extraArgs);
        };

        d.trigger = function( obj, event, extraArgs ) {
            // summary: 
            //        Trigger some event. It can be either a Dom Event, Custom Event, 
            //        or direct function call. 
            //
            // description:
            //        Trigger some event. It can be either a Dom Event, Custom Event, 
            //        or direct function call. NOTE: This function does not trigger
            //        default behavior, only triggers bound event listeneres. eg:
            //        one cannot trigger("anchorNode", "onclick") and expect the browser
            //        to follow the href="" attribute naturally.
            //
            // obj: String|DomNode|Object|Function
            //        An ID, or DomNode reference, from which to trigger the event.
            //        If an Object, fire the `event` in the scope of this object,
            //        similar to calling dojo.hitch(obj, event)(). The return value
            //        in this case is returned from `dojo.trigger`
            //     
            // event: String|Function
            //        The name of the event to trigger. can be any DOM level 2 event
            //        and can be in either form: "onclick" or "click" for instance.
            //        In the object-firing case, this method can be a function or
            //        a string version of a member function, just like `dojo.hitch`.
            //
            // extraArgs: Object?
            //        An object to mix into the `event` object passed to any bound 
            //        listeners. Be careful not to override important members, like
            //        `type`, or `preventDefault`. It will likely error.
            //
            //        Additionally, extraArgs is moot in the object-triggering case,
            //        as all arguments beyond the `event` are curried onto the triggered
            //        function.
            //
            // example: 
            //    |    dojo.connect(node, "onclick", function(e){             //    |    // later:
            //    |    dojo.trigger(node, "onclick");
            //
            // example:
            //    |    // or from within dojo.query: (requires dojo.NodeList)
            //    |    dojo.query("a").onclick(function(){}).trigger("onclick");
            //
            // example:
            //    |    // fire obj.method() in scope of obj
            //    |    dojo.trigger(obj, "method");
            //
            // example:
            //    |    // fire an anonymous function:
            //    |    dojo.trigger(d.global, function(){             //
            // example: 
            //    |    // fire and anonymous function in the scope of obj
            //    |    dojo.trigger(obj, function(){ this == obj; });
            //
            // example:
            //    |    // with a connected function like:
            //    |    dojo.connect(dojo.doc, "onclick", function(e){
            //    |        if(e && e.manuallydone){
            //    |            console.log("this was a triggered onclick, not natural");
            //    |        }
            //    |    });
            //    |    // fire onclick, passing in a custom bit of info
            //    |    dojo.trigger("someId", "onclick", { manuallydone:true });
            //
            // returns: Anything
            //        Will not return anything in the Dom event case, but will return whatever
            //        return value is received from the triggered event. 
            return (isfn(obj) || isfn(event) || isfn(obj[event])) ? d.hitch.apply(d, arguments)() : d._trigger.apply(d, arguments);
        };

        // adapt for dojo.query:
    dojo.extend(dojo.NodeList, {
        trigger: function(event, data){
            // summary:
            //        Trigger some Event originating from each of the nodes in this
            //        `dojo.NodeList`. 
            //
            // event: String
            //        Any strig identifier for the event.type to be triggered.
            //
            // data: Object
            //        Just like `extraArgs` for `dojo.trigger`, additional data
            //        to mix into the event object.
            //
            // example:
            //    |    dojo.query("a").trigger("onclick");
            
            return this; // dojo.NodeList
        }
    });
    =====*/
        d.NodeList.prototype.trigger = d.NodeList._adaptAsForEach(d._trigger);

        // if the node.js module is available, extend trigger into that.
        if ( d._Node && !d._Node.prototype.trigger ) {
            d.extend(d._Node, {
                trigger: function( ev, data ) {
                    // summary:
                    //        Fire some some event originating from this node.
                    //        Only available if both the `dojo.trigger` and `dojo.node` plugin 
                    //        are enabled. Allows chaining as all `dojo._Node` methods do.
                    //
                    // ev: String
                    //        Some string event name to fire. eg: "onclick", "submit"
                    //
                    // data: Object
                    //        Just like `extraArgs` for `dojo.trigger`, additional data
                    //        to mix into the event object.
                    //
                    // example:
                    //    |    // fire onlick orginiating from a node with id="someAnchorId"
                    //    |    dojo.node("someAnchorId").trigger("click");
                    d._trigger(this, ev, data);
                    return this; // dojo._Node
                }
            });
        }

        return d.trigger;

    });

    var Deferred = function( func ) {
        if (!(this instanceof Deferred)) return new Deferred();

        this._doneFuncs = [];
        this._failFuncs = [];
        this._resultArgs = null;
        this._status = "";

        // check for option function: call it with this as context and as first 
        // parameter, as specified in jQuery api
        func && func.call(this, this);
    };
    can.Deferred = Deferred;
    can.when = Deferred.when = function() {
        var args = can.makeArray(arguments);
        if ( args.length < 2 ) {
            var obj = args[0];
            if ( obj && (can.isFunction(obj.isResolved) && can.isFunction(obj.isRejected)) ) {
                return obj;
            } else {
                return Deferred().resolve(obj);
            }
        } else {

            var df = Deferred(),
                done = 0,
                // resolve params: params of each resolve, we need to track down 
                // them to be able to pass them in the correct order if the master 
                // needs to be resolved
                rp = [];

            can.each(args, function( j, arg ) {
                arg.done(function() {
                    rp[j] = (arguments.length < 2) ? arguments[0] : arguments;
                    if (++done == args.length ) {
                        df.resolve.apply(df, rp);
                    }
                }).fail(function() {
                    df.reject(arguments);
                });
            });

            return df;

        }
    }

    var resolveFunc = function( type, _status ) {
        return function( context ) {
            var args = this._resultArgs = (arguments.length > 1) ? arguments[1] : [];
            return this.exec(context, this[type], args, _status);
        }
    },
        doneFunc = function( type, _status ) {
            return function() {
                var self = this;
            so we have to convert arguments to an Array that allows can.each to loop over them*/
                can.each(Array.prototype.slice.call(arguments), function( i, v, args ) {
                    if (!v ) return;
                    if ( v.constructor === Array ) {
                        args.callee.apply(self, v)
                    } else {
                        // immediately call the function if the deferred has been resolved
                        if ( self._status === _status ) v.apply(self, self._resultArgs || []);

                        self[type].push(v);
                    }
                });
                return this;
            }
        };

    can.extend(Deferred.prototype, {
        pipe: function( done, fail ) {
            var d = can.Deferred();
            this.done(function() {
                d.resolve(done.apply(this, arguments));
            });

            this.fail(function() {
                if ( fail ) {
                    d.reject(fail.apply(this, arguments));
                } else {
                    d.reject.apply(d, arguments);
                }
            });
            return d;
        },
        resolveWith: resolveFunc("_doneFuncs", "rs"),
        rejectWith: resolveFunc("_failFuncs", "rj"),
        done: doneFunc("_doneFuncs", "rs"),
        fail: doneFunc("_failFuncs", "rj"),
        always: function() {
            var args = can.makeArray(arguments);
            if ( args.length && args[0] ) this.done(args[0]).fail(args[0]);

            return this;
        },

        then: function() {
            var args = can.makeArray(arguments);
            // fail function(s)
            if ( args.length > 1 && args[1] ) this.fail(args[1]);

            // done function(s)
            if ( args.length && args[0] ) this.done(args[0]);

            return this;
        },

        isResolved: function() {
            return this._status === "rs";
        },

        isRejected: function() {
            return this._status === "rj";
        },

        reject: function() {
            return this.rejectWith(this, arguments);
        },

        resolve: function() {
            return this.resolveWith(this, arguments);
        },

        exec: function( context, dst, args, st ) {
            if ( this._status !== "" ) return this;

            this._status = st;

            can.each(dst, function( i, d ) {
                d.apply(context, args);
            });

            return this;
        }
    });

    // ##string.js
    // _Miscellaneous string utility functions._  
    // Several of the methods in this plugin use code adapated from Prototype
    // Prototype JavaScript framework, version 1.6.0.1.
    // © 2005-2007 Sam Stephenson
    var undHash = /_|-/,
        colons = /==/,
        words = /([A-Z]+)([A-Z][a-z])/g,
        lowUp = /([a-z\d])([A-Z])/g,
        dash = /([a-z\d])([A-Z])/g,
        replacer = /\{([^\}]+)\}/g,
        quote = /"/g,
        singleQuote = /'/g,

        // Returns the `prop` property from `obj`.
        // If `add` is true and `prop` doesn't exist in `obj`, create it as an 
        // empty object.
        getNext = function( obj, prop, add ) {
            return prop in obj ? obj[prop] : (add && (obj[prop] = {}));
        },

        // Returns `true` if the object can have properties (no `null`s).
        isContainer = function( current ) {
            return /^f|^o/.test(typeof current);
        };

    can.extend(can, {
                // Escapes strings for HTML.
        esc: function( content ) {
            return ("" + content).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(quote, '&#34;').replace(singleQuote, "&#39;");
        },

                getObject: function( name, roots, add ) {

            // The parts of the name we are looking up  
            // `['App','Models','Recipe']`
            var parts = name ? name.split('.') : [],
                length = parts.length,
                current, r = 0,
                ret, i;

            // Make sure roots is an `array`.
            roots = can.isArray(roots) ? roots : [roots || window];

            if (!length ) {
                return roots[0];
            }

            // For each root, mark it as current.
            while ( current = roots[r++] ) {

                // Walk current to the 2nd to last object or until there 
                // is not a container.
                for ( i = 0; i < length - 1 && isContainer(current); i++ ) {
                    current = getNext(current, parts[i], add);
                }

                // If we can get a property from the 2nd to last object...
                if ( isContainer(current) ) {

                    // Get (and possibly set) the property.
                    ret = getNext(current, parts[i], add);

                    // If there is a value, we exit.
                    if ( ret !== undefined ) {
                        // If `add` is `false`, delete the property
                        if ( add === false ) {
                            delete current[parts[i]];
                        }
                        return ret;

                    }
                }
            }
        },
                // Capitalizes a string.
        capitalize: function( s, cache ) {
            // Used to make newId.
            return s.charAt(0).toUpperCase() + s.slice(1);
        },

                // Underscores a string.
        underscore: function( s ) {
            return s.replace(colons, '/').replace(words, '$1_$2').replace(lowUp, '$1_$2').replace(dash, '_').toLowerCase();
        },
                // Micro-templating.
        sub: function( str, data, remove ) {

            var obs = [];

            obs.push(str.replace(replacer, function( whole, inside ) {

                // Convert inside to type.
                var ob = can.getObject(inside, data, remove);

                // If a container, push into objs (which will return objects found).
                if ( isContainer(ob) ) {
                    obs.push(ob);
                    return "";
                } else {
                    return "" + ob;
                }
            }));

            return obs.length <= 1 ? obs[0] : obs;
        },

        // These regex's are used throughout the rest of can, so let's make
        // them available.
        replacer: replacer,
        undHash: undHash
    });

    // ## construct.js
    // `can.Construct`  
    // _This is a modified version of
    // [John Resig's class](http://ejohn.org/blog/simple-javascript-inheritance/).  
    // It provides class level inheritance and callbacks._
    // A private flag used to initialize a new class instance without
    // initializing it's bindings.
    var initializing = 0;

        can.Construct = function() {
        if ( arguments.length ) {
            return can.Construct.extend.apply(can.Construct, arguments);
        }
    };

        can.extend(can.Construct, {
                newInstance: function() {
            // Get a raw instance object (`init` is not called).
            var inst = this.instance(),
                arg = arguments,
                args;

            // Call `setup` if there is a `setup`
            if ( inst.setup ) {
                args = inst.setup.apply(inst, arguments);
            }

            // Call `init` if there is an `init`  
            // If `setup` returned `args`, use those as the arguments
            if ( inst.init ) {
                inst.init.apply(inst, args || arguments);
            }

            return inst;
        },
        // Overwrites an object with methods. Used in the `super` plugin.
        // `newProps` - New properties to add.  
        // `oldProps` - Where the old properties might be (used with `super`).  
        // `addTo` - What we are adding to.
        _inherit: function( newProps, oldProps, addTo ) {
            can.extend(addTo || newProps, newProps || {})
        },
                // Set `defaults` as the merger of the parent `defaults` and this 
        // object's `defaults`. If you overwrite this method, make sure to
        // include option merging logic.
        setup: function( base, fullName ) {
            this.defaults = can.extend(true, {}, base.defaults, this.defaults);
        },
        // Create's a new `class` instance without initializing by setting the
        // `initializing` flag.
        instance: function() {

            // Prevents running `init`.
            initializing = 1;

            var inst = new this();

            // Allow running `init`.
            initializing = 0;

            return inst;
        },
                // Extends classes.
        extend: function( fullName, klass, proto ) {
            // Figure out what was passed and normalize it.
            if ( typeof fullName != 'string' ) {
                proto = klass;
                klass = fullName;
                fullName = null;
            }

            if (!proto ) {
                proto = klass;
                klass = null;
            }
            proto = proto || {};

            var _super_class = this,
                _super = this.prototype,
                name, shortName, namespace, prototype;

            // Instantiate a base class (but only create the instance,
            // don't run the init constructor).
            prototype = this.instance();

            // Copy the properties over onto the new prototype.
            _super_class._inherit(proto, _super, prototype);

            // The dummy class constructor.

            function Constructor() {
                // All construction is actually done in the init method.
                if (!initializing ) {
                    return this.constructor !== Constructor && arguments.length ?
                    // We are being called without `new` or we are extending.
                    arguments.callee.extend.apply(arguments.callee, arguments) :
                    // We are being called with `new`.
                    this.constructor.newInstance.apply(this.constructor, arguments);
                }
            }

            // Copy old stuff onto class (can probably be merged w/ inherit)
            for ( name in _super_class ) {
                if ( _super_class.hasOwnProperty(name) ) {
                    Constructor[name] = _super_class[name];
                }
            }

            // Copy new static properties on class.
            _super_class._inherit(klass, _super_class, Constructor);

            // Setup namespaces.
            if ( fullName ) {

                var parts = fullName.split('.'),
                    shortName = parts.pop(),
                    current = can.getObject(parts.join('.'), window, true),
                    namespace = current,
                    _fullName = can.underscore(fullName.replace(/\./g, "_")),
                    _shortName = can.underscore(shortName);

                //@steal-remove-start
                if ( current[shortName] ) {

                }
                //@steal-remove-end
                current[shortName] = Constructor;
            }

            // Set things that shouldn't be overwritten.
            can.extend(Constructor, {
                constructor: Constructor,
                prototype: prototype,
                                namespace: namespace,
                                shortName: shortName,
                _shortName: _shortName,
                                fullName: fullName,
                _fullName: _fullName
            });

            // Make sure our prototype looks nice.
            Constructor.prototype.constructor = Constructor;

            // Call the class `setup` and `init`
            var t = [_super_class].concat(can.makeArray(arguments)),
                args = Constructor.setup.apply(Constructor, t);

            if ( Constructor.init ) {
                Constructor.init.apply(Constructor, args || t);
            }

                        return Constructor;
                        //break up
                        //Breaks up code
                    }

    });

    // ## observe.js  
    // `can.Observe`  
    // _Provides the observable pattern for JavaScript Objects._
    // Returns `true` if something is an object with properties of its own.
    var canMakeObserve = function( obj ) {
        return obj && typeof obj === 'object' && !(obj instanceof Date);
    },

        // Removes all listeners.
        unhookup = function( items, namespace ) {
            return can.each(items, function( i, item ) {
                if ( item && item.unbind ) {
                    item.unbind("change" + namespace);
                }
            });
        },
        // Listens to changes on `val` and "bubbles" the event up.  
        // `val` - The object to listen for changes on.  
        // `prop` - The property name is at on.  
        // `parent` - The parent object of prop.  
        hookupBubble = function( val, prop, parent ) {
            // If it's an `array` make a list, otherwise a val.
            if ( val instanceof Observe ) {
                // We have an `observe` already...
                // Make sure it is not listening to this already
                unhookup([val], parent._namespace);
            } else if ( can.isArray(val) ) {
                val = new Observe.List(val);
            } else {
                val = new Observe(val);
            }

            // Listen to all changes and `batchTrigger` upwards.
            val.bind("change" + parent._namespace, function( ev, attr ) {
                // `batchTrigger` the type on this...
                var args = can.makeArray(arguments),
                    ev = args.shift();
                args[0] = prop === "*" ? parent.indexOf(val) + "." + args[0] : prop + "." + args[0];
                can.trigger(parent, ev, args);
            });

            return val;
        },

        // An `id` to track events for a given observe.
        observeId = 0,
        // A reference to an `array` of events that will be dispatched.
        collecting = undefined,
        // Call to start collecting events (`Observe` sends all events at
        // once).
        collect = function() {
            if (!collecting ) {
                collecting = [];
                return true;
            }
        },
        // Creates an event on item, but will not send immediately 
        // if collecting events.  
        // `item` - The item the event should happen on.  
        // `event` - The event name, ex: `change`.  
        // `args` - Tn array of arguments.
        batchTrigger = function( item, event, args ) {
            // Don't send events if initalizing.
            if (!item._init ) {
                if (!collecting ) {
                    return can.trigger(item, event, args);
                } else {
                    collecting.push([
                    item,
                    {
                        type: event,
                        batchNum: batchNum
                    },
                    args]);
                }
            }
        },
        // Which batch of events this is for -- might not want to send multiple
        // messages on the same batch.  This is mostly for event delegation.
        batchNum = 1,
        // Sends all pending events.
        sendCollection = function() {
            var items = collecting.slice(0);
            collecting = undefined;
            batchNum++;
            can.each(items, function( i, item ) {
                can.trigger.apply(can, item)
            })

        },
        // A helper used to serialize an `Observe` or `Observe.List`.  
        // `observe` - The observable.  
        // `how` - To serialize with `attr` or `serialize`.  
        // `where` - To put properties, in an `{}` or `[]`.
        serialize = function( observe, how, where ) {
            // Go through each property.
            observe.each(function( name, val ) {
                // If the value is an `object`, and has an `attrs` or `serialize` function.
                where[name] = canMakeObserve(val) && can.isFunction(val[how]) ?
                // Call `attrs` or `serialize` to get the original data back.
                val[how]() :
                // Otherwise return the value.
                val
            })
            return where;
        },
        $method = function( name ) {
            return function() {
                return can[name].apply(this, arguments);
            }
        },
        bind = $method('addEvent'),
        unbind = $method('removeEvent'),
        attrParts = function( attr ) {
            return can.isArray(attr) ? attr : ("" + attr).split(".")
        };
        var Observe = can.Construct('can.Observe', {
        // keep so it can be overwritten
        setup: function() {
            can.Construct.setup.apply(this, arguments)
        },
        bind: bind,
        unbind: unbind,
        id: "id"
    },
        {
        setup: function( obj ) {
            // `_data` is where we keep the properties.
            this._data = {};
            // The namespace this `object` uses to listen to events.
            this._namespace = ".observe" + (++observeId);
            // Sets all `attrs`.
            this._init = 1;
            this.attr(obj);
            delete this._init;
        },
                attr: function( attr, val ) {
            // This is super obfuscated for space -- basically, we're checking
            // if the type of the attribute is not a `number` or a `string`.
            if (!~"ns".indexOf((typeof attr).charAt(0)) ) {
                return this._attrs(attr, val)
            } else if ( val === undefined ) { // If we are getting a value.
                // Let people know we are reading.
                Observe.__reading && Observe.__reading(this, attr)
                return this._get(attr)
            } else {
                // Otherwise we are setting.
                this._set(attr, val);
                return this;
            }
        },
                each: function() {
            return can.each.apply(undefined, [this.__get()].concat(can.makeArray(arguments)))
        },
                removeAttr: function( attr ) {
            // Convert the `attr` into parts (if nested).
            var parts = attrParts(attr),
                // The actual property to remove.
                prop = parts.shift(),
                // The current value.
                current = this._data[prop];

            // If we have more parts, call `removeAttr` on that part.
            if ( parts.length ) {
                return current.removeAttr(parts)
            } else {
                // Otherwise, `delete`.
                delete this._data[prop];
                // Create the event.
                if (!(prop in this.constructor.prototype)) {
                    delete this[prop]
                }
                batchTrigger(this, "change", [prop, "remove", undefined, current]);
                batchTrigger(this, prop, undefined, current);
                return current;
            }
        },
        // Reads a property from the `object`.
        _get: function( attr ) {
            var parts = attrParts(attr),
                current = this.__get(parts.shift());
            return parts.length ? current ? current._get(parts) : undefined : current;
        },
        // Reads a property directly if an `attr` is provided, otherwise
        // returns the "real" data object itself.
        __get: function( attr ) {
            return attr ? this._data[attr] : this._data;
        },
        // Sets `attr` prop as value on this object where.
        // `attr` - Is a string of properties or an array  of property values.
        // `value` - The raw value to set.
        _set: function( attr, value ) {
            // Convert `attr` to attr parts (if it isn't already).
            var parts = attrParts(attr),
                // The immediate prop we are setting.
                prop = parts.shift(),
                // The current value.
                current = this.__get(prop);

            // If we have an `object` and remaining parts.
            if ( canMakeObserve(current) && parts.length ) {
                // That `object` should set it (this might need to call attr).
                current._set(parts, value)
            } else if (!parts.length ) {
                // We're in "real" set territory.
                if ( this.__convert ) {
                    value = this.__convert(prop, value)
                }
                this.__set(prop, value, current)

            } else {
                throw "can.Observe: Object does not exist"
            }
        },
        __set: function( prop, value, current ) {

            // Otherwise, we are setting it on this `object`.
            // TODO: Check if value is object and transform
            // are we changing the value.
            if ( value !== current ) {

                // Check if we are adding this for the first time --
                // if we are, we need to create an `add` event.
                var changeType = this.__get().hasOwnProperty(prop) ? "set" : "add";

                // Set the value on data.
                this.___set(prop,

                // If we are getting an object.
                canMakeObserve(value) ?

                // Hook it up to send event.
                hookupBubble(value, prop, this) :
                // Value is normal.
                value);

                // `batchTrigger` the change event.
                batchTrigger(this, "change", [prop, changeType, value, current]);
                batchTrigger(this, prop, value, current);
                // If we can stop listening to our old value, do it.
                current && unhookup([current], this._namespace);
            }

        },
        // Directly sets a property on this `object`.
        ___set: function( prop, val ) {
            this._data[prop] = val;
            // Add property directly for easy writing.
            // Check if its on the `prototype` so we don't overwrite methods like `attrs`.
            if (!(prop in this.constructor.prototype)) {
                this[prop] = val
            }
        },
                bind: bind,
                unbind: unbind,
                serialize: function() {
            return serialize(this, 'serialize', {});
        },
                _attrs: function( props, remove ) {
            if ( props === undefined ) {
                return serialize(this, 'attr', {})
            }

            props = can.extend(true, {}, props);
            var prop, collectingStarted = collect(),
                self = this,
                newVal;

            this.each(function( prop, curVal ) {
                newVal = props[prop];

                // If we are merging...
                if ( newVal === undefined ) {
                    remove && self.removeAttr(prop);
                    return;
                }
                if ( canMakeObserve(curVal) && canMakeObserve(newVal) ) {
                    curVal.attr(newVal, remove)
                } else if ( curVal != newVal ) {
                    self._set(prop, newVal)
                } else {

                }
                delete props[prop];
            })
            // Add remaining props.
            for ( var prop in props ) {
                newVal = props[prop];
                this._set(prop, newVal)
            }
            if ( collectingStarted ) {
                sendCollection();
            }
            return this;
        }
    });
    // Helpers for `observable` lists.
        var splice = [].splice,
        list = Observe('can.Observe.List',
                {
            setup: function( instances, options ) {
                this.length = 0;
                this._namespace = ".observe" + (++observeId);
                this._init = 1;
                this.bind('change', can.proxy(this._changes, this));
                this.push.apply(this, can.makeArray(instances || []));
                can.extend(this, options);
                delete this._init;
            },
            _changes: function( ev, attr, how, newVal, oldVal ) {
                // `batchTrigger` direct add and remove events...
                if (!~attr.indexOf('.') ) {

                    if ( how === 'add' ) {
                        batchTrigger(this, how, [newVal, +attr]);
                        batchTrigger(this, 'length', [this.length]);
                    } else if ( how === 'remove' ) {
                        batchTrigger(this, how, [oldVal, +attr]);
                        batchTrigger(this, 'length', [this.length]);
                    } else {
                        batchTrigger(this, how, [newVal, +attr])
                    }

                }
            },
            __get: function( attr ) {
                return attr ? this[attr] : this;
            },
            ___set: function( attr, val ) {
                this[attr] = val;
                if (+attr >= this.length ) {
                    this.length = (+attr + 1)
                }
            },
                        // Returns the serialized form of this list.
            serialize: function() {
                return serialize(this, 'serialize', []);
            },
                        //
                        splice: function( index, howMany ) {
                var args = can.makeArray(arguments),
                    i;

                for ( i = 2; i < args.length; i++ ) {
                    var val = args[i];
                    if ( canMakeObserve(val) ) {
                        args[i] = hookupBubble(val, "*", this)
                    }
                }
                if ( howMany === undefined ) {
                    howMany = args[1] = this.length - index;
                }
                var removed = splice.apply(this, args);
                if ( howMany > 0 ) {
                    batchTrigger(this, "change", ["" + index, "remove", undefined, removed]);
                    unhookup(removed, this._namespace);
                }
                if ( args.length > 2 ) {
                    batchTrigger(this, "change", ["" + index, "add", args.slice(2), removed]);
                }
                return removed;
            },
                        _attrs: function( props, remove ) {
                if ( props === undefined ) {
                    return serialize(this, 'attr', []);
                }

                // Create a copy.
                props = props.slice(0);

                var len = Math.min(props.length, this.length),
                    collectingStarted = collect(),
                    prop;

                for ( var prop = 0; prop < len; prop++ ) {
                    var curVal = this[prop],
                        newVal = props[prop];

                    if ( canMakeObserve(curVal) && canMakeObserve(newVal) ) {
                        curVal.attr(newVal, remove)
                    } else if ( curVal != newVal ) {
                        this._set(prop, newVal)
                    } else {

                    }
                }
                if ( props.length > this.length ) {
                    // Add in the remaining props.
                    this.push(props.slice(this.length))
                } else if ( props.length < this.length && remove ) {
                    this.splice(props.length)
                }

                if ( collectingStarted ) {
                    sendCollection()
                }
            }
        }),

        // Converts to an `array` of arguments.
        getArgs = function( args ) {
            return args[0] && can.isArray(args[0]) ? args[0] : can.makeArray(args);
        };
    // Create `push`, `pop`, `shift`, and `unshift`
    can.each({
                push: "length",
                unshift: 0
    },
    // Adds a method
    // `name` - The method name.
    // `where` - Where items in the `array` should be added.

    function( name, where ) {
        list.prototype[name] = function() {
            // Get the items being added.
            var args = getArgs(arguments),
                // Where we are going to add items.
                len = where ? this.length : 0;

            // Go through and convert anything to an `observe` that needs to be converted.
            for ( var i = 0; i < args.length; i++ ) {
                var val = args[i];
                if ( canMakeObserve(val) ) {
                    args[i] = hookupBubble(val, "*", this)
                }
            }

            // Call the original method.
            var res = [][name].apply(this, args);

            if (!this.comparator || !args.length ) {
                batchTrigger(this, "change", ["" + len, "add", args, undefined])
            }

            return res;
        }
    });

    can.each({
                pop: "length",
                shift: 0
    },
    // creates a `remove` type method

    function( name, where ) {
        list.prototype[name] = function() {

            var args = getArgs(arguments),
                len = where && this.length ? this.length - 1 : 0;

            var res = [][name].apply(this, args)

            // Create a change where the args are
            // `*` - Change on potentially multiple properties.
            // `remove` - Items removed.
            // `undefined` - The new values (there are none).
            // `res` - The old, removed values (should these be unbound).
            // `len` - Where these items were removed.
            batchTrigger(this, "change", ["" + len, "remove", undefined, [res]])

            if ( res && res.unbind ) {
                res.unbind("change" + this._namespace)
            }
            return res;
        }
    });

    list.prototype.
        indexOf = [].indexOf ||
    function( item ) {
        return can.inArray(item, this)
    };

    // ## model.js  
    // `can.Model`  
    // _A `can.Observe` that connects to a RESTful interface._
        // Generic deferred piping function
    var pipe = function( def, model, func ) {
        var d = new can.Deferred();
        def.then(function() {
            arguments[0] = model[func](arguments[0])
            d.resolve.apply(d, arguments)
        }, function() {
            d.resolveWith.apply(this, arguments)
        })
        return d;
    },
        modelNum = 0,
        ignoreHookup = /change.observe\d+/,
        getId = function( inst ) {
            return inst[inst.constructor.id]
        },
        // Ajax `options` generator function
        ajax = function( ajaxOb, data, type, dataType, success, error ) {

            // If we get a string, handle it.
            if ( typeof ajaxOb == "string" ) {
                // If there's a space, it's probably the type.
                var parts = ajaxOb.split(" ")
                ajaxOb = {
                    url: parts.pop()
                };
                if ( parts.length ) {
                    ajaxOb.type = parts.pop();
                }
            }

            // If we are a non-array object, copy to a new attrs.
            ajaxOb.data = typeof data == "object" && !can.isArray(data) ? can.extend(ajaxOb.data || {}, data) : data;

            // Get the url with any templated values filled out.
            ajaxOb.url = can.sub(ajaxOb.url, ajaxOb.data, true);

            return can.ajax(can.extend({
                type: type || "post",
                dataType: dataType || "json",
                success: success,
                error: error
            }, ajaxOb));
        },
        makeRequest = function( self, type, success, error, method ) {
            var deferred, args = [self.serialize()],
                // The model.
                model = self.constructor,
                jqXHR;

            // `destroy` does not need data.
            if ( type == 'destroy' ) {
                args.shift();
            }
            // `update` and `destroy` need the `id`.
            if ( type !== 'create' ) {
                args.unshift(getId(self))
            }

            jqXHR = model[type].apply(model, args);

            deferred = jqXHR.pipe(function( data ) {
                self[method || type + "d"](data, jqXHR);
                return self
            })

            // Hook up `abort`
            if ( jqXHR.abort ) {
                deferred.abort = function() {
                    jqXHR.abort();
                }
            }

            return deferred.then(success, error);
        },

        
        // This object describes how to make an ajax request for each ajax method.  
        // The available properties are:
        //        `url` - The default url to use as indicated as a property on the model.
        //        `type` - The default http request type
        //        `data` - A method that takes the `arguments` and returns `data` used for ajax.
        ajaxMethods = {
                        create: {
                url: "_shortName",
                type: "post"
            },
                        update: {
                data: function( id, attrs ) {
                    attrs = attrs || {};
                    var identity = this.id;
                    if ( attrs[identity] && attrs[identity] !== id ) {
                        attrs["new" + can.capitalize(id)] = attrs[identity];
                        delete attrs[identity];
                    }
                    attrs[identity] = id;
                    return attrs;
                },
                type: "put"
            },
                        destroy: {
                type: "delete",
                data: function( id ) {
                    return {}[this.id] = id;
                }
            },
                        findAll: {
                url: "_shortName"
            },
                        findOne: {}
        },
        // Makes an ajax request `function` from a string.
        //        `ajaxMethod` - The `ajaxMethod` object defined above.
        //        `str` - The string the user provided. Ex: `findAll: "/recipes.json"`.
        ajaxMaker = function( ajaxMethod, str ) {
            // Return a `function` that serves as the ajax method.
            return function( data ) {
                // If the ajax method has it's own way of getting `data`, use that.
                data = ajaxMethod.data ? ajaxMethod.data.apply(this, arguments) :
                // Otherwise use the data passed in.
                data;
                // Return the ajax method with `data` and the `type` provided.
                return ajax(str || this[ajaxMethod.url || "_url"], data, ajaxMethod.type || "get")
            }
        }

        can.Observe("can.Model", {
            setup: function() {
                can.Observe.apply(this, arguments);
                if ( this === can.Model ) {
                    return;
                }
                var self = this;

                can.each(ajaxMethods, function( name, method ) {
                    if (!can.isFunction(self[name]) ) {
                        self[name] = ajaxMaker(method, self[name]);
                    }
                });
                var clean = can.proxy(this._clean, self);
                can.each({
                    findAll: "models",
                    findOne: "model"
                }, function( name, method ) {
                    var old = self[name];
                    self[name] = function( params, success, error ) {
                        // Increment requests.
                        self._reqs++;
                        // Make the request.
                        return pipe(old.call(self, params), self, method).then(success, error).then(clean, clean);
                    }

                })
                // Convert `findAll` and `findOne`.
                var oldFindAll
                if ( self.fullName == "can.Model" ) {
                    self.fullName = "Model" + (++modelNum);
                }
                // Ddd ajax converters.
                this.store = {};
                this._reqs = 0;
                this._url = this._shortName + "/{" + this.id + "}"
            },
            _clean: function() {
                this._reqs--;
                if (!this._reqs ) {
                    for ( var id in this.store ) {
                        if (!this.store[id]._bindings ) {
                            delete this.store[id];
                        }
                    }
                }
            },
                        models: function( instancesRawData ) {
                if (!instancesRawData ) {
                    return;
                }
                // Get the list type.
                var self = this,
                    res = new(self.List || ML),
                    // Did we get an `array`?
                    arr = can.isArray(instancesRawData),

                    // Did we get a model list?
                    ml = (instancesRawData instanceof ML),

                    // Get the raw `array` of objects.
                    raw = arr ?

                    // If an `array`, return the `array`.
                    instancesRawData :

                    // Otherwise if a model list.
                    (ml ?

                    // Get the raw objects from the list.
                    instancesRawData.serialize() :

                    // Get the object's data.
                    instancesRawData.data),
                    i = 0;

                can.each(raw, function( i, rawPart ) {
                    res.push(self.model(rawPart));
                });

                if (!arr ) { // Push other stuff onto `array`.
                    can.each(instancesRawData, function( prop, val ) {
                        if ( prop !== 'data' ) {
                            res[prop] = val;
                        }
                    })
                }
                return res;
            },
                        model: function( attributes ) {
                if (!attributes ) {
                    return;
                }
                if ( attributes instanceof this ) {
                    attributes = attributes.serialize();
                }
                var model = this.store[attributes.id] || new this(attributes);
                if ( this._reqs ) {
                    this.store[attributes.id] = model;
                }
                return model;
            }
                        // 
                        // 
                        // 
        },
                {
                        isNew: function() {
                var id = getId(this);
                return !(id || id === 0); // If `null` or `undefined`
            },
                        save: function( success, error ) {
                return makeRequest(this, this.isNew() ? 'create' : 'update', success, error);
            },
                        destroy: function( success, error ) {
                return makeRequest(this, 'destroy', success, error, 'destroyed');
            },
                        bind: function( eventName ) {
                if (!ignoreHookup.test(eventName) ) {
                    if (!this._bindings ) {
                        this.constructor.store[getId(this)] = this;
                        this._bindings = 0;
                    }
                    this._bindings++;
                }

                return can.Observe.prototype.bind.apply(this, arguments);
            },
                        unbind: function( eventName ) {
                if (!ignoreHookup.test(eventName) ) {
                    this._bindings--;
                    if (!this._bindings ) {
                        delete this.constructor.store[getId(this)];
                    }
                }
                return can.Observe.prototype.unbind.apply(this, arguments);
            },
            // Change `id`.
            ___set: function( prop, val ) {
                can.Observe.prototype.___set.call(this, prop, val)
                // If we add an `id`, move it to the store.
                if ( prop === this.constructor.id && this._bindings ) {
                    this.constructor.store[getId(this)] = this;
                }
            }
        });

    can.each([
        "created",
        "updated",
        "destroyed"], function( i, funcName ) {
        can.Model.prototype[funcName] = function( attrs ) {
            var stub, constructor = this.constructor;

            // Update attributes if attributes have been passed
            stub = attrs && typeof attrs == 'object' && this.attr(attrs.attr ? attrs.attr() : attrs);

            // Call event on the instance
            can.trigger(this, funcName);
            can.trigger(this, "change", funcName)

            // Call event on the instance's Class
            can.trigger(constructor, funcName, this);
        };
    });

    // Model lists are just like `Observe.List` except that when their items are 
    // destroyed, it automatically gets removed from the list.
        var ML = can.Observe.List('can.Model.List', {
        setup: function() {
            can.Observe.List.prototype.setup.apply(this, arguments);
            // Send destroy events.
            var self = this;
            this.bind('change', function( ev, how ) {
                if (/\w+\.destroyed/.test(how) ) {
                    self.splice(self.indexOf(ev.target), 1);
                }
            })
        }
    })

    ;

    var digitTest = /^\d+$/,
        keyBreaker = /([^\[\]]+)|(\[\])/g,
        paramTest = /([^?#]*)(#.*)?$/,
        prep = function( str ) {
            return decodeURIComponent(str.replace(/\+/g, " "));
        }

        can.extend(can, {

                        deparam: function( params ) {

                var data = {},
                    pairs;

                if ( params && paramTest.test(params) ) {

                    pairs = params.split('&'),

                    can.each(pairs, function( i, pair ) {

                        var parts = pair.split('='),
                            key = prep(parts.shift()),
                            value = prep(parts.join("="));

                        current = data;
                        parts = key.match(keyBreaker);

                        for ( var j = 0, l = parts.length - 1; j < l; j++ ) {
                            if (!current[parts[j]] ) {
                                // if what we are pointing to looks like an array
                                current[parts[j]] = digitTest.test(parts[j + 1]) || parts[j + 1] == "[]" ? [] : {}
                            }
                            current = current[parts[j]];
                        }
                        lastPart = parts.pop()
                        if ( lastPart == "[]" ) {
                            current.push(value)
                        } else {
                            current[lastPart] = value;
                        }
                    });
                }
                return data;
            }
        });

    // Helper methods used for matching routes.
    var
    // RegEx used to match route variables of the type ':name'.
    // Any word character or a period is matched.
    matcher = /\:([\w\.]+)/g,
        // Regular expression for identifying &amp;key=value lists.
        paramsMatcher = /^(?:&[^=]+=[^&]*)+/,
        // Converts a JS Object into a list of parameters that can be 
        // inserted into an html element tag.
        makeProps = function( props ) {
            return can.map(props, function( val, name ) {
                return (name === 'className' ? 'class' : name) + '="' + can.esc(val) + '"';
            }).join(" ");
        },
        // Checks if a route matches the data provided. If any route variable
        // is not present in the data the route does not match. If all route
        // variables are present in the data the number of matches is returned 
        // to allow discerning between general and more specific routes. 
        matchesData = function( route, data ) {
            var count = 0,
                i = 0;
            for (; i < route.names.length; i++ ) {
                if (!data.hasOwnProperty(route.names[i]) ) {
                    return -1;
                }
                count++;
            }
            return count;
        },
        // 
        onready = !0,
        location = window.location,
        each = can.each,
        extend = can.extend;

    can.route = function( url, defaults ) {
        // Extract the variable names and replace with regEx that will match an atual URL with values.
        var names = [],
            test = url.replace(matcher, function( whole, name ) {
                names.push(name)
                // TODO: I think this should have a +
                return "([^\\/\\&]*)" // The '\\' is for string-escaping giving single '\' for regEx escaping
            });

        // Add route in a form that can be easily figured out
        can.route.routes[url] = {
            // A regular expression that will match the route when variable values 
            // are present; i.e. for :page/:type the regEx is /([\w\.]*)/([\w\.]*)/ which
            // will match for any value of :page and :type (word chars or period).
            test: new RegExp("^" + test + "($|&)"),
            // The original URL, same as the index for this entry in routes.
            route: url,
            // An array of all the variable names in this route
            names: names,
            // Default values provided for the variables.
            defaults: defaults || {},
            // The number of parts in the URL separated by '/'.
            length: url.split('/').length
        }
        return can.route;
    };

    extend(can.route, {
                param: function( data ) {
            delete data.route;
            // Check if the provided data keys match the names in any routes;
            // get the one with the most matches.
            var route,
            // need it to be at least 1 match
            matches = 0,
                matchCount, routeName = data.route;

            // if we have a route name in our can.route data, use it
            if (!(routeName && (route = can.route.routes[routeName]))) {
                // otherwise find route
                each(can.route.routes, function( name, temp ) {
                    matchCount = matchesData(temp, data);
                    if ( matchCount > matches ) {
                        route = temp;
                        matches = matchCount
                    }
                });
            }

            // if this is match
            if ( route ) {
                var cpy = extend({}, data),
                    // Create the url by replacing the var names with the provided data.
                    // If the default value is found an empty string is inserted.
                    res = route.route.replace(matcher, function( whole, name ) {
                        delete cpy[name];
                        return data[name] === route.defaults[name] ? "" : encodeURIComponent(data[name]);
                    }),
                    after;
                // remove matching default values
                each(route.defaults, function( name, val ) {
                    if ( cpy[name] === val ) {
                        delete cpy[name]
                    }
                })

                // The remaining elements of data are added as 
                // $amp; separated parameters to the url.
                after = can.param(cpy);
                return res + (after ? "&" + after : "")
            }
            // If no route was found there is no hash URL, only paramters.
            return can.isEmptyObject(data) ? "" : "&" + can.param(data);
        },
                deparam: function( url ) {
            // See if the url matches any routes by testing it against the route.test regEx.
            // By comparing the URL length the most specialized route that matches is used.
            var route = {
                length: -1
            };
            each(can.route.routes, function( name, temp ) {
                if ( temp.test.test(url) && temp.length > route.length ) {
                    route = temp;
                }
            });
            // If a route was matched
            if ( route.length > -1 ) {
                var // Since RegEx backreferences are used in route.test (round brackets)
                // the parts will contain the full matched string and each variable (backreferenced) value.
                parts = url.match(route.test),
                    // start will contain the full matched string; parts contain the variable values.
                    start = parts.shift(),
                    // The remainder will be the &amp;key=value list at the end of the URL.
                    remainder = url.substr(start.length - (parts[parts.length - 1] === "&" ? 1 : 0)),
                    // If there is a remainder and it contains a &amp;key=value list deparam it.
                    obj = (remainder && paramsMatcher.test(remainder)) ? can.deparam(remainder.slice(1)) : {};

                // Add the default values for this route
                obj = extend(true, {}, route.defaults, obj);
                // Overwrite each of the default values in obj with those in parts if that part is not empty.
                each(parts, function( i, part ) {
                    if ( part && part !== '&' ) {
                        obj[route.names[i]] = decodeURIComponent(part);
                    }
                });
                obj.route = route.route;
                return obj;
            }
            // If no route was matched it is parsed as a &amp;key=value list.
            if ( url.charAt(0) !== '&' ) {
                url = '&' + url;
            }
            return paramsMatcher.test(url) ? can.deparam(url.slice(1)) : {};
        },
                data: new can.Observe({}),
                routes: {},
                ready: function( val ) {
            if ( val === false ) {
                onready = val;
            }
            if ( val === true || onready === true ) {
                setState();
            }
            return can.route;
        },
                url: function( options, merge ) {
            if ( merge ) {
                options = extend({}, curParams, options)
            }
            return "#!" + can.route.param(options)
        },
                link: function( name, options, props, merge ) {
            return "<a " + makeProps(
            extend({
                href: can.route.url(options, merge)
            }, props)) + ">" + name + "</a>";
        },
                current: function( options ) {
            return location.hash == "#!" + can.route.param(options)
        }
    });

    // The functions in the following list applied to can.route (e.g. can.route.attr('...')) will
    // instead act on the can.route.data Observe.
    each(['bind', 'unbind', 'delegate', 'undelegate', 'attr', 'removeAttr'], function( i, name ) {
        can.route[name] = function() {
            return can.route.data[name].apply(can.route.data, arguments)
        }
    })

    var // A ~~throttled~~ debounced function called multiple times will only fire once the
    // timer runs down. Each call resets the timer. (throttled functions
    // are called once every x seconds)
    timer,
    // Intermediate storage for can.route.data.
    curParams,
    // Deparameterizes the portion of the hash of interest and assign the
    // values to the can.route.data removing existing values no longer in the hash.
    setState = function() {
        curParams = can.route.deparam(location.hash.split(/#!?/).pop());
        can.route.attr(curParams, true);
    };

    // If the hash changes, update the can.route.data
    can.bind.call(window, 'hashchange', setState);

    // If the can.route.data changes, update the hash.
    // Using .serialize() retrieves the raw data contained in the observable.
    // This function is ~~throttled~~ debounced so it only updates once even if multiple values changed.
    can.route.bind("change", function() {
        clearTimeout(timer);
        timer = setTimeout(function() {
            location.hash = "#!" + can.route.param(can.route.data.serialize())
        }, 1);
    });
    // onready event ...
    can.bind.call(document, "ready", can.route.ready);

    // ## control.js
    // `can.Control`  
    // _Controller_
    // Binds an element, returns a function that unbinds.
    var bind = function( el, ev, callback ) {

        can.bind.call(el, ev, callback)

        return function() {
            can.unbind.call(el, ev, callback);
        };
    },
        isFunction = can.isFunction,
        extend = can.extend,
        each = can.each,
        slice = [].slice,
        special = can.getObject("$.event.special") || {},

        // Binds an element, returns a function that unbinds.
        delegate = function( el, selector, ev, callback ) {
            can.delegate.call(el, selector, ev, callback)
            return function() {
                can.undelegate.call(el, selector, ev, callback);
            };
        },

        // Calls bind or unbind depending if there is a selector.
        binder = function( el, ev, callback, selector ) {
            return selector ? delegate(el, can.trim(selector), ev, callback) : bind(el, ev, callback);
        },

        // Moves `this` to the first argument, wraps it with `jQuery` if it's an element
        shifter = function shifter(context, name) {
            var method = typeof name == "string" ? context[name] : name;
            return function() {
                context.called = name;
                return method.apply(context, [this.nodeName ? can.$(this) : this].concat(slice.call(arguments, 0)));
            };
        },
        basicProcessor;

        can.Construct("can.Control",
        {
                // Setup pre-processes which methods are event listeners.
        setup: function() {

            // Allow contollers to inherit "defaults" from super-classes as it 
            // done in `can.Construct`
            can.Construct.setup.apply(this, arguments);

            // If you didn't provide a name, or are `control`, don't do anything.
            if ( this !== can.Control ) {

                // Cache the underscored names.
                var control = this,
                    funcName;

                // Calculate and cache actions.
                control.actions = {};

                for ( funcName in control.prototype ) {
                    if ( funcName == 'constructor' || !isFunction(control.prototype[funcName]) ) {
                        continue;
                    }
                    if ( control._isAction(funcName) ) {
                        control.actions[funcName] = control._action(funcName);
                    }
                }
            }
        },
                // Return `true` if is an action.
        _isAction: function( methodName ) {
            return !!(special[methodName] || processors[methodName] || /[^\w]/.test(methodName));
        },
                // Takes a method name and the options passed to a control
        // and tries to return the data necessary to pass to a processor
        // (something that binds things).
        _action: function( methodName, options ) {

            // If we don't have options (a `control` instance), we'll run this 
            // later.  
            // `/\{([^\}]+)\}/` - parameter replacer regex.
            if ( options || !/\{([^\}]+)\}/g.test(methodName) ) {
                // If we have options, run sub to replace templates `{}` with a
                // value from the options or the window
                var convertedName = options ? can.sub(methodName, [options, window]) : methodName,

                    // If a `{}` resolves to an object, `convertedName` will be
                    // an array
                    arr = can.isArray(convertedName),

                    // Get the parts of the function  
                    // `[convertedName, delegatePart, eventPart]`  
                    // `/^(?:(.*?)\s)?([\w\.\:>]+)$/` - Breaker regex.
                    parts = (arr ? convertedName[1] : convertedName).match(/^(?:(.*?)\s)?([\w\.\:>]+)$/),
                    event = parts[2],
                    processor = processors[event] || basicProcessor;
                return {
                    processor: processor,
                    parts: parts,
                    delegate: arr ? convertedName[0] : undefined
                };
            }
        },
                // An object of `{eventName : function}` pairs that Control uses to 
        // hook up events auto-magically.
        processors: {},
                // A object of name-value pairs that act as default values for a 
        // control instance
        defaults: {}
    },
        {
                // Where the magic happens.
        setup: function( element, options ) {

            var cls = this.constructor,
                pluginname = cls.pluginName || cls._fullName;

            // Want the raw element here.
            this.element = can.$(element)

            if ( pluginname && pluginname !== 'can_control' ) {
                // Set element and `className` on element.
                this.element.addClass(pluginname);
            }

            (can.data(this.element, "controls")) || can.data(this.element, "controls", [this]);

                        // Option merging.
            this.options = extend({}, cls.defaults, options);

            // Bind all event handlers.
            this.on();

                        // Get's passed into `init`.
            return [this.element, this.options];
        },
                on: function( el, selector, eventName, func ) {

            if (!el ) {

                // Adds bindings.
                this.off();

                // Go through the cached list of actions and use the processor 
                // to bind
                var cls = this.constructor,
                    bindings = this._bindings,
                    actions = cls.actions,
                    element = this.element,
                    destroyCB = shifter(this, "destroy"),
                    funcName;

                for ( funcName in actions ) {
                    if ( actions.hasOwnProperty(funcName) ) {
                        ready = actions[funcName] || cls._action(funcName, this.options);
                        bindings.push(
                        ready.processor(ready.delegate || element, ready.parts[2], ready.parts[1], funcName, this));
                    }
                }

                // Setup to be destroyed...  
                // don't bind because we don't want to remove it.
                can.bind.call(element, "destroyed", destroyCB);
                bindings.push(function( el ) {
                    can.unbind.call(el, "destroyed", destroyCB);
                });
                return bindings.length;
            }

            if ( typeof el == 'string' ) {
                func = eventName;
                eventName = selector;
                selector = el;
                el = this.element;
            }

            if ( typeof func == 'string' ) {
                func = shifter(this, func);
            }

            this._bindings.push(binder(el, eventName, func, selector));

            return this._bindings.length;
        },
                // Unbinds all event handlers on the controller.
        off: function() {
            var el = this.element[0]
            each(this._bindings || [], function( key, value ) {
                value(el);
            });
            // Adds bindings.
            this._bindings = [];
        },
        
        // Prepares a `control` for garbage collection
        destroy: function() {
            var Class = this.constructor,
                pluginName = Class.pluginName || Class._fullName,
                controls;

            // Unbind bindings.
            this.off();

            if ( pluginName && pluginName !== 'can_control' ) {
                // Remove the `className`.
                this.element.removeClass(pluginName);
            }

            // Remove from `data`.
            controls = can.data(this.element, "controls");
            controls.splice(can.inArray(this, controls), 1);

            can.trigger(this, "destroyed"); // In case we want to know if the `control` is removed.
            this.element = null;
        }
    });

    var processors = can.Control.processors,

        // Processors do the binding.  
        // They return a function that unbinds when called.  
        //
        // The basic processor that binds events.
        basicProcessor = function( el, event, selector, methodName, control ) {
            return binder(el, event, shifter(control, methodName), selector);
        };

    // Set common events to be processed as a `basicProcessor`
    each(["change", "click", "contextmenu", "dblclick", "keydown", "keyup", "keypress", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup", "reset", "resize", "scroll", "select", "submit", "focusin", "focusout", "mouseenter", "mouseleave"], function( i, v ) {
        processors[v] = basicProcessor;
    });

    can.Control.processors.route = function( el, event, selector, funcName, controller ) {
        can.route(selector || "")
        var batchNum, check = function( ev, attr, how ) {
            if ( can.route.attr('route') === (selector || "") && (ev.batchNum === undefined || ev.batchNum !== batchNum) ) {

                batchNum = ev.batchNum;

                var d = can.route.attr();
                delete d.route;

                controller[funcName](d)
            }
        }
        can.route.bind('change', check);
        return function() {
            can.route.unbind('change', check)
        }
    };

    // a path like string into something that's ok for an element ID
    var toId = function( src ) {
        return src.split(/\/|\./g).join("_");
    },
        isFunction = can.isFunction,
        makeArray = can.makeArray,
        // used for hookup ids
        hookupId = 1,
        // this might be useful for testing if html
        // htmlTest = /^[\s\n\r\xA0]*<(.|[\r\n])*>[\s\n\r\xA0]*$/
                $view = can.view = function( view, data, helpers, callback ) {
            // get the result
            var result = $view.render(view, data, helpers, callback);
            if ( can.isDeferred(result) ) {
                return result.pipe(function( result ) {
                    return $view.frag(result);
                })
            }

            // convert it into a dom frag
            return $view.frag(result);
        };

    can.extend($view, {
        frag: function( result ) {
            var frag = can.buildFragment([result], [document.body]).fragment;
            // if we have an empty fraga
            if (!frag.childNodes.length ) {
                frag.appendChild(document.createTextNode(''))
            }
            return $view.hookup(frag);
        },
        hookup: function( fragment ) {
            var hookupEls = [],
                id, func, el, i = 0;

            // get all childNodes
            can.each(fragment.childNodes ? can.makeArray(fragment.childNodes) : fragment, function( i, node ) {
                if ( node.nodeType === 1 ) {
                    hookupEls.push(node)
                    hookupEls.push.apply(hookupEls, can.makeArray(node.getElementsByTagName('*')))
                }
            });
            // filter by data-view-id attribute
            for (; el = hookupEls[i++]; ) {

                if ( el.getAttribute && (id = el.getAttribute('data-view-id')) && (func = $view.hookups[id]) ) {
                    func(el, id);
                    delete $view.hookups[id];
                    el.removeAttribute('data-view-id');
                }
            }
            return fragment;
        },
                hookups: {},
                hook: function( cb ) {
            $view.hookups[++hookupId] = cb;
            return " data-view-id='" + hookupId + "'";
        },
                cached: {},
                cache: true,
                register: function( info ) {
            this.types["." + info.suffix] = info;
        },
        types: {},
                ext: ".ejs",
                registerScript: function() {},
                preload: function() {},
        render: function( view, data, helpers, callback ) {
            // if helpers is a function, it is actually a callback
            if ( isFunction(helpers) ) {
                callback = helpers;
                helpers = undefined;
            }

            // see if we got passed any deferreds
            var deferreds = getDeferreds(data);

            if ( deferreds.length ) { // does data contain any deferreds?
                // the deferred that resolves into the rendered content ...
                var deferred = new can.Deferred();

                // add the view request to the list of deferreds
                deferreds.push(get(view, true))

                // wait for the view and all deferreds to finish
                can.when.apply(can, deferreds).then(function( resolved ) {
                    // get all the resolved deferreds
                    var objs = makeArray(arguments),
                        // renderer is last [0] is the data
                        renderer = objs.pop(),
                        // the result of the template rendering with data
                        result;

                    // make data look like the resolved deferreds
                    if ( can.isDeferred(data) ) {
                        data = usefulPart(resolved);
                    }
                    else {
                        // go through each prop in data again,
                        // replace the defferreds with what they resolved to
                        for ( var prop in data ) {
                            if ( can.isDeferred(data[prop]) ) {
                                data[prop] = usefulPart(objs.shift());
                            }
                        }
                    }
                    // get the rendered result
                    result = renderer(data, helpers);

                    //resolve with the rendered view
                    deferred.resolve(result);
                    // if there's a callback, call it back with the result
                    callback && callback(result);
                });
                // return the deferred ....
                return deferred;
            }
            else {
                // no deferreds, render this bad boy
                var response,
                // if there's a callback function
                async = isFunction(callback),
                    // get the 'view' type
                    deferred = get(view, async);

                // if we are async, 
                if ( async ) {
                    // return the deferred
                    response = deferred;
                    // and callback callback with the rendered result
                    deferred.then(function( renderer ) {
                        callback(renderer(data, helpers))
                    })
                } else {
                    // otherwise, the deferred is complete, so
                    // set response to the result of the rendering
                    deferred.then(function( renderer ) {
                        response = renderer(data, helpers);
                    });
                }

                return response;
            }
        }
    });
    // returns true if something looks like a deferred
    can.isDeferred = function( obj ) {
        return obj && isFunction(obj.then) && isFunction(obj.pipe) // check if obj is a can.Deferred
    }
    // makes sure there's a template, if not, has steal provide a warning
    var checkText = function( text, url ) {
        if (!text.length ) {
            //@steal-remove-start
            //@steal-remove-end
            throw "can.view: No template or empty template:" + url;
        }
    },
        // returns a 'view' renderer deferred
        // url - the url to the view template
        // async - if the ajax request should be synchronous
        // returns a deferred
        get = function( url, async ) {

            var suffix = url.match(/\.[\w\d]+$/),
                type,
                // if we are reading a script element for the content of the template
                // el will be set to that script element
                el,
                // a unique identifier for the view (used for caching)
                // this is typically derived from the element id or
                // the url for the template
                id,
                // the AJAX request used to retrieve the template content
                jqXHR,
                // used to generate the response 
                response = function( text ) {
                    // get the renderer function
                    var func = type.renderer(id, text),
                        d = new can.Deferred();
                    d.resolve(func)
                    // cache if if we are caching
                    if ( $view.cache ) {
                        $view.cached[id] = d;
                    }
                    // return the objects for the response's dataTypes 
                    // (in this case view)
                    return d;
                };

            // if we have an inline template, derive the suffix from the 'text/???' part
            // this only supports '<script></script>' tags
            if ( el = document.getElementById(url) ) {
                suffix = "." + el.type.match(/\/(x\-)?(.+)/)[2];
            }

            // if there is no suffix, add one
            if (!suffix ) {
                url += (suffix = $view.ext);
            }
            if ( can.isArray(suffix) ) {
                suffix = suffix[0]
            }

            // convert to a unique and valid id
            id = toId(url);

            // if a absolute path, use steal to get it
            // you should only be using // if you are using steal
            if ( url.match(/^\/\//) ) {
                var sub = url.substr(2);
                url = !window.steal ? "/" + sub : steal.root.mapJoin(sub);
            }

            //set the template engine type 
            type = $view.types[suffix];

            // if it is cached, 
            if ( $view.cached[id] ) {
                // return the cached deferred renderer
                return $view.cached[id];

                // otherwise if we are getting this from a script elment
            } else if ( el ) {
                // resolve immediately with the element's innerHTML
                return response(el.innerHTML);
            } else {
                // make an ajax request for text
                var d = new can.Deferred();
                can.ajax({
                    async: async,
                    url: url,
                    dataType: "text",
                    error: function( jqXHR ) {
                        checkText("", url);
                        d.reject(jqXHR);
                    },
                    success: function( text ) {
                        // make sure we got some text back
                        checkText(text, url);
                        d.resolve(type.renderer(id, text))
                        // cache if if we are caching
                        if ( $view.cache ) {
                            $view.cached[id] = d;
                        }

                    }
                });
                return d;
            }
        },
        // gets an array of deferreds from an object
        // this only goes one level deep
        getDeferreds = function( data ) {
            var deferreds = [];

            // pull out deferreds
            if ( can.isDeferred(data) ) {
                return [data]
            } else {
                for ( var prop in data ) {
                    if ( can.isDeferred(data[prop]) ) {
                        deferreds.push(data[prop]);
                    }
                }
            }
            return deferreds;
        },
        // gets the useful part of deferred
        // this is for Models and can.ajax that resolve to array (with success and such)
        // returns the useful, content part
        usefulPart = function( resolved ) {
            return can.isArray(resolved) && resolved[1] === 'success' ? resolved[0] : resolved
        };

    // HELPER METHODS ==============
    var myEval = function( script ) {
        eval(script);
    },
        // removes the last character from a string
        // this is no longer needed
        extend = can.extend,
        // regular expressions for caching
        quickFunc = /\s*\(([\$\w]+)\)\s*->([^\n]*)/,
        attrReg = /([^\s]+)=$/,
        newLine = /(\r|\n)+/g,
        attributeReplace = /__!!__/g,
        tagMap = {
            "": "span",
            table: "tr",
            tr: "td",
            ol: "li",
            ul: "li",
            tbody: "tr",
            thead: "tr",
            tfoot: "tr"
        },
        // escapes characters starting with \
        clean = function( content ) {
            return content.split('\\').join("\\\\").split("\n").join("\\n").split('"').join('\\"').split("\t").join("\\t");
        },
        bracketNum = function( content ) {
            return (--content.split("{").length) - (--content.split("}").length);
        },
        setAttr = function( el, attrName, val ) {
            attrName === "class" ? (el.className = val) : el.setAttribute(attrName, val);
        },
        getAttr = function( el, attrName ) {
            return attrName === "class" ? el.className : el.getAttribute(attrName);
        },
        // used to bind to an observe, and unbind when the element is removed
        // oldObserved is a mapping of observe namespaces to instances
        liveBind = function( observed, el, cb, oldObserved ) {
            // we are going to set everything to matched that we find
            var first = oldObserved.matched === undefined;
            oldObserved.matched = !oldObserved.matched;
            can.each(observed, function( i, ob ) {
                if ( oldObserved[ob.obj._namespace + "|" + ob.attr] ) {
                    oldObserved[ob.obj._namespace + "|" + ob.attr].matched = oldObserved.matched;
                } else {
                    ob.matched = oldObserved.matched;
                    oldObserved[ob.obj._namespace + "|" + ob.attr] = ob
                    ob.obj.bind(ob.attr, cb)
                }
            })
            // remove any old bindings
            for ( var name in oldObserved ) {
                var ob = oldObserved[name];
                if ( name !== "matched" && ob.matched !== oldObserved.matched ) {
                    ob.obj.unbind(ob.attr);
                    delete oldObserved[name];
                }
            }
            if ( first ) {
                can.bind.call(el, 'destroyed', function() {
                    can.each(oldObserved, function( i, ob ) {
                        if ( typeof ob !== 'boolean' ) {
                            ob.obj.unbind(ob.attr, cb)
                        }
                    })
                })
            }

        },
        contentEscape = function( txt ) {
            //return sanatized text
            return (typeof txt == 'string' || typeof txt == 'number') ? can.esc(txt) : contentText(txt);
        },
        contentText = function( input ) {

            // if it's a string, return
            if ( typeof input == 'string' ) {
                return input;
            }
            // if has no value
            if (!input && input != 0 ) {
                return '';
            }

            // if it's an object, and it has a hookup method
            var hook = (input.hookup &&
            // make a function call the hookup method

            function( el, id ) {
                input.hookup.call(input, el, id);
            }) ||
            // or if it's a function, just use the input
            (typeof input == 'function' && input);
            // finally, if there is a funciton to hookup on some dom
            // add it to pending hookups
            if ( hook ) {
                pendingHookups.push(hook);
                return '';
            }
            // finally, if all else false, toString it
            return "" + input;
        },
        getValueAndObserved = function( func, self ) {
            if ( can.Observe ) {
                can.Observe.__reading = function( obj, attr ) {
                    observed.push({
                        obj: obj,
                        attr: attr
                    });
                }
            }
            // get value
            var observed = [],
                input = func.call(self);

            // set back so we are no longer reading
            if ( can.Observe ) {
                delete can.Observe.__reading;
            }
            return {
                value: input,
                observed: observed
            }
        },
                EJS = function( options ) {
            if ( this.constructor != EJS ) {
                var ejs = new EJS(options);
                return function( data, helpers ) {
                    return ejs.render(data, helpers);
                };
            }
            // if we get a function directly, it probably is coming from
            // a steal-packaged view
            if ( typeof options == "function" ) {
                this.template = {
                    fn: options
                };
                return;
            }
            //set options on self
            extend(this, options);
            this.template = scan(this.text, this.name);
        };
    // add EJS to jQuery if it exists
    can.EJS = EJS;
        EJS.prototype.
        render = function( object, extraHelpers ) {
        object = object || {};
        return this.template.fn.call(object, object, new EJS.Helpers(object, extraHelpers || {}));
    };
        extend(EJS, {
                txt: function( tagName, status, self, func, escape ) {
            // set callback on reading ...
            var res = getValueAndObserved(func, self),
                observed = res.observed,
                input = res.value,
                oldObserved = {},
                tag = (tagMap[tagName] || "span");

            // if we had no observes
            if (!observed.length ) {
                return (escape || status !== 0 ? contentEscape : contentText)(input);
            }

            if ( status == 0 ) {
                return "<" + tag + can.view.hook(
                // are we escaping
                escape ?
                // 

                function( el ) {
                    // remove child, bind on parent
                    var parent = el.parentNode,
                        node = document.createTextNode(input),
                        binder = function() {
                            var res = getValueAndObserved(func, self);
                            node.nodeValue = "" + res.value;
                            liveBind(res.observed, parent, binder, oldObserved);
                        };

                    parent.insertBefore(node, el);
                    parent.removeChild(el);

                    // create textNode
                    liveBind(observed, parent, binder, oldObserved);
                } : function( span ) {
                    // remove child, bind on parent
                    var makeAndPut = function( val, remove ) {
                        // get fragement of html to fragment
                        var frag = can.view.frag(val),
                            // wrap it to keep a reference to the elements .. 
                            nodes = can.$(can.map(frag.childNodes, function( node ) {
                                return node;
                            })),
                            last = remove[remove.length - 1];

                        // insert it in the document
                        if ( last.nextSibling ) {
                            last.parentNode.insertBefore(frag, last.nextSibling)
                        } else {
                            last.parentNode.appendChild(frag)
                        }

                        // remove the old content
                        can.remove(can.$(remove));
                        //can.view.hookup(nodes);
                        return nodes;
                    },
                        nodes = makeAndPut(input, [span]);
                    // listen to changes and update
                    // make sure the parent does not die
                    // we might simply check that nodes is still in the document 
                    // before a write ...
                    var binder = function() {
                        var res = getValueAndObserved(func, self);
                        nodes = makeAndPut(res.value, nodes);

                        liveBind(res.observed, span.parentNode, binder, oldObserved);
                    }
                    liveBind(observed, span.parentNode, binder, oldObserved);
                    //return parent;
                }) + "></" + tag + ">";
            } else if ( status === 1 ) { // in a tag
                // mark at end!
                var attrName = input.replace(/['"]/g, '').split('=')[0];
                pendingHookups.push(function( el ) {
                    var binder = function() {
                        var res = getValueAndObserved(func, self),
                            parts = (res.value || "").replace(/['"]/g, '').split('='),
                            newAttrName = parts[0];

                        // remove if we have a change and used to have an attrName
                        if ((newAttrName != attrName) && attrName ) {
                            el.removeAttribute(attrName)
                        }
                        // set if we have a new attrName
                        if ( newAttrName ) {
                            setAttr(el, newAttrName, parts[1])
                        }
                        liveBind(res.observed, el, binder, oldObserved);
                    }

                    liveBind(observed, el, binder, oldObserved);
                });

                return input;
            } else { // in an attribute
                pendingHookups.push(function( el ) {
                    var wrapped = can.$(el),
                        hooks;

                    // get the list of hookups or create one for this element
                    // hooks is a map of attribute name to hookup data
                    // each hookup data has
                    //  - render - a function to render the value of the attribute
                    //  - funcs - a list of hookup functions on that attribute
                    //  - batchNum - the last event batchNum, used for performance    
                    (hooks = can.data(wrapped, 'hooks')) || can.data(wrapped, 'hooks', hooks = {});

                    // get the attribute value
                    var attr = getAttr(el, status),
                        // split the attribute value by the template 
                        parts = attr.split("__!!__"),
                        hook, binder = function( ev ) {
                            if ( ev.batchNum === undefined || ev.batchNum !== hook.batchNum ) {
                                hook.batchNum = ev.batchNum;
                                setAttr(el, status, hook.render());
                            }
                        };

                    // if we already had a hookup for this attribute
                    if ( hooks[status] ) {
                        // just add to that attribute's list of functions
                        hooks[status].funcs.push({
                            func: func,
                            old: oldObserved
                        });
                    }
                    else {
                        // create the hookup data
                        hooks[status] = {
                            render: function() {
                                var i = 0,
                                    newAttr = attr.replace(attributeReplace, function() {
                                        var ob = getValueAndObserved(hook.funcs[i].func, self);
                                        liveBind(ob.observed, el, binder, hook.funcs[i++].old)
                                        return contentText(ob.value);
                                    });
                                return newAttr;
                            },
                            funcs: [{
                                func: func,
                                old: oldObserved
                            }],
                            batchNum: undefined
                        };
                    };
                    //  getValueAndObserved(func, self)
                    // save the hook for slightly faster performance
                    hook = hooks[status];
                    // insert the value in parts
                    parts.splice(1, 0, input);
                    // set the attribute
                    setAttr(el, status, parts.join(""));

                    // bind on cha
                    liveBind(observed, el, binder, oldObserved);
                })
                return "__!!__";
            }
        },
        // called to setup escaped text
        esc: function( tagName, status, self, func ) {
            return EJS.txt(tagName, status, self, func, true)
        },
        pending: function() {
            if ( pendingHookups.length ) {
                var hooks = pendingHookups.slice(0);

                pendingHookups = [];
                return can.view.hook(function( el ) {
                    can.each(hooks, function( i, fn ) {
                        fn(el);
                    })
                });
            } else {
                return "";
            }
        }
    });
    // ========= SCANNING CODE =========
    var tokenReg = new RegExp("(" + ["<%%", "%%>", "<%==", "<%=", "<%#", "<%", "%>", "<", ">", '"', "'"].join("|") + ")", "g"),
        // commands for caching
        startTxt = 'var ___v1ew = [];',
        finishTxt = "return ___v1ew.join('')",
        put_cmd = "___v1ew.push(",
        insert_cmd = put_cmd,
        // global controls (used by other functions to know where we are)
        // are we inside a tag
        htmlTag = null,
        // are we within a quote within a tag
        quote = null,
        // what was the text before the current quote (used to get the attr name)
        beforeQuote = null,
        // used to mark where the element is
        status = function() {
            // t - 1
            // h - 0
            // q - string beforeQuote
            return quote ? "'" + beforeQuote.match(attrReg)[1] + "'" : (htmlTag ? 1 : 0)
        },
        pendingHookups = [],
        scan = function( source, name ) {
            var tokens = [],
                last = 0;

            source = source.replace(newLine, "\n");
            source.replace(tokenReg, function( whole, part, offset ) {
                if ( offset > last ) {
                    tokens.push(source.substring(last, offset));
                }
                tokens.push(part)
                last = offset + part.length;
            })
            if ( last === 0 ) {
                tokens.push(source)
            }

            var content = '',
                buff = [startTxt],
                // helper function for putting stuff in the view concat
                put = function( content, bonus ) {
                    buff.push(put_cmd, '"', clean(content), '"' + (bonus || '') + ');');
                },
                // a stack used to keep track of how we should end a bracket }
                // once we have a <%= %> with a leftBracket
                // we store how the file should end here (either '))' or ';' )
                endStack = [],
                // the last token, used to remember which tag we are in
                lastToken,
                // the corresponding magic tag
                startTag = null,
                // was there a magic tag inside an html tag
                magicInTag = false,
                // the current tag name
                tagName = '',
                // declared here
                bracketCount, i = 0,
                token;

            // re-init the tag state goodness
            htmlTag = quote = beforeQuote = null;

            for (;
            (token = tokens[i++]) !== undefined; ) {

                if ( startTag === null ) {
                    switch ( token ) {
                    case '<%':
                    case '<%=':
                    case '<%==':
                        magicInTag = 1;
                    case '<%#':
                        // a new line, just add whatever content w/i a clean
                        // reset everything
                        startTag = token;
                        if ( content.length ) {
                            put(content);
                        }
                        content = '';
                        break;

                    case '<%%':
                        // replace <%% with <%
                        content += '<%';
                        break;
                    case '<':
                        // make sure we are not in a comment
                        if ( tokens[i].indexOf("!--") !== 0 ) {
                            htmlTag = 1;
                            magicInTag = 0;
                        }
                        content += token;
                        break;
                    case '>':
                        htmlTag = 0;
                        // TODO: all <%= in tags should be added to pending hookups
                        if ( magicInTag ) {
                            put(content, ",can.EJS.pending(),\">\"");
                            content = '';
                        } else {
                            content += token;
                        }

                        break;
                    case "'":
                    case '"':
                        // if we are in an html tag, finding matching quotes
                        if ( htmlTag ) {
                            // we have a quote and it matches
                            if ( quote && quote === token ) {
                                // we are exiting the quote
                                quote = null;
                                // otherwise we are creating a quote
                                // TOOD: does this handle "\""
                            } else if ( quote === null ) {
                                quote = token;
                                beforeQuote = lastToken;
                            }
                        }
                    default:
                        if ( lastToken === '<' ) {
                            tagName = token.split(' ')[0];
                        }
                        content += token;
                        break;
                    }
                }
                else {
                    //we have a start tag
                    switch ( token ) {
                    case '%>':
                        // %>
                        switch ( startTag ) {
                        case '<%':
                            // <%
                            // get the number of { minus }
                            bracketCount = bracketNum(content);

                            // we are ending a block
                            if ( bracketCount == 1 ) {
                                // we are starting on
                                buff.push(insert_cmd, "can.EJS.txt('" + tagName + "'," + status() + ",this,function(){", startTxt, content);

                                endStack.push({
                                    before: "",
                                    after: finishTxt + "}));"
                                })
                            }
                            else {

                                // how are we ending this statement
                                var last = // if the stack has value and we are ending a block
                                endStack.length && bracketCount == -1 ? // use the last item in the block stack
                                endStack.pop() : // or use the default ending
                                {
                                    after: ";"
                                };

                                // if we are ending a returning block
                                // add the finish text which returns the result of the
                                // block 
                                if ( last.before ) {
                                    buff.push(last.before)
                                }
                                // add the remaining content
                                buff.push(content, ";", last.after);
                            }
                            break;
                        case '<%=':
                        case '<%==':
                            // - we have an extra { -> block
                            // get the number of { minus } 
                            bracketCount = bracketNum(content);
                            // if we have more {, it means there is a block
                            if ( bracketCount ) {
                                // when we return to the same # of { vs } end wiht a doubleParen
                                endStack.push({
                                    before: finishTxt,
                                    after: "}));"
                                })
                            }
                            // check if its a func like ()->
                            if ( quickFunc.test(content) ) {
                                var parts = content.match(quickFunc)
                                content = "function(__){var " + parts[1] + "=can.$(__);" + parts[2] + "}"
                            }

                            // if we have <%== a(function(){ %> then we want
                            //  can.EJS.text(0,this, function(){ return a(function(){ var _v1ew = [];
                            buff.push(insert_cmd, "can.EJS." + (startTag === '<%=' ? "esc" : "txt") + "('" + tagName + "'," + status() + ",this,function(){ return ", content,
                            // if we have a block
                            bracketCount ?
                            // start w/ startTxt "var _v1ew = [];"
                            startTxt :
                            // if not, add doubleParent to close push and text
                            "}));");
                            break;
                        }
                        startTag = null;
                        content = '';
                        break;
                    case '<%%':
                        content += '<%';
                        break;
                    default:
                        content += token;
                        break;
                    }

                }
                lastToken = token;
            }

            // put it together ..
            if ( content.length ) {
                // Should be content.dump in Ruby
                put(content)
            }
            buff.push(";")
            var template = buff.join(''),
                out = {
                    out: 'with(_VIEW) { with (_CONTEXT) {' + template + " " + finishTxt + "}}"
                };
            //use eval instead of creating a function, b/c it is easier to debug
            myEval.call(out, 'this.fn = (function(_CONTEXT,_VIEW){' + out.out + '});\r\n//@ sourceURL=' + name + ".js");
            return out;
        };

        EJS.Helpers = function( data, extras ) {
        this._data = data;
        this._extras = extras;
        extend(this, extras);
    };
        EJS.Helpers.prototype = {
                view: function( url, data, helpers ) {
            return $View(url, data || this._data, helpers || this._extras); //new EJS(options).render(data, helpers);
        },
        list: function( list, cb ) {
            list.attr('length')
            for ( var i = 0, len = list.length; i < len; i++ ) {
                cb(list[i], i, list)
            }
        }
    };

    // options for steal's build
    can.view.register({
        suffix: "ejs",
        //returns a function that renders the view
        script: function( id, src ) {
            return "can.EJS(function(_CONTEXT,_VIEW) { " + new EJS({
                text: src,
                name: id
            }).template.out + " })";
        },
        renderer: function( id, text ) {
            return EJS({
                text: text,
                name: id
            });
        }
    });
})(can = {}, this)