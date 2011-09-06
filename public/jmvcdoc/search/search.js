steal('jquery/controller',
	'jquery/lang/observe/delegate',
	'jmvcdoc/models/search.js',function($){

/**
 * @class Jmvcdoc.Search
 */
$.Controller('Jmvcdoc.Search',
/* @Static */
{
	defaults : {
	
	}
},
/* @Prototype */
{
	init : function(){
		this.element.attr('disabled', false)
	},
	"keyup" : function(){
		clearTimeout(this.searchTimer);
		this.searchTimer = setTimeout(this.callback('search'),200)
	},
	search : function(){
		var val = this.element.val();
		if(val){
			window.location.hash = "#&search="+val
		} else {
			window.location.hash = "";
		}
		
		//this.options.clientState.merge({search : }, true)
	},
	"{clientState} search set" : function(clientState, ev, newVal){
		this.element.val(newVal)
	},
	focusin : function(){
		this.focused = true;
	},
	focusout : function(){
		this.focused = false;
	}
})

});