(function(a){var d,i=function(c,k){var b=a.$(c);b.data("controllers")||b.data("controllers",k||{});return b.data("controllers")},j=a.makeArray,l=a.Control.setup;a.Control.setup=function(){if(this!==a.Control){var c=this.pluginName||this._fullName;"can_control"!==c&&this.plugin(c);l.apply(this,arguments)}};a.prototype.extend({controllers:function(){var c=j(arguments),a=[],b,f,g;this.each(function(){b=i(this);for(g in b)if(b.hasOwnProperty(g)){f=b[g];var e;if(!(e=!c.length))a:{e=f;var h=c;for(d=0;d<
h.length;d++)if("string"==typeof h[d]?e.constructor._shortName==h[d]:e instanceof h[d]){e=!0;break a}e=!1}e&&a.push(f)}});return a},controller:function(c){return this.controllers.apply(this,arguments)[0]}});a.Control.plugin=function(c){var d=this;a.prototype[c]||(a.prototype[c]=function(a){var f=j(arguments),g="string"==typeof a&&$.isFunction(d.prototype[a]),e=f[0];return this.each(function(){var a=i(this),b=a&&a[c];b?g?b[e].apply(b,f.slice(1)):b.update.apply(b,f):a[c]=d.newInstance.apply(d,[this].concat(f))})})};
a.Control.prototype.update=function(a){extend(this.options,a);this.on()}})(can={},this);
