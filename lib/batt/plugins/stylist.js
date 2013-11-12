/**
* Plugin to automatically apply parameters to objects as they are created
* e.g.
*
*	batt.plugin('stylist', function() {
*		batt
*			.addStyle('.container', {
*				renderTag: '<div class="widget-box"><div class="widget-title"><span class="icon"><i class="{{icon}}"></i></span><h5>{{title}}</h5></div><div class="widget-content"></div></div>',
*				title: 'FIXME: Add title',
*				icon: 'icon-cicle',
*			})
*			.stylist();
*	});
*
*
* 
* @requires Batt
* @author Matt Carter <m@ttcarter.com>
*/
$(function() {

$.extend(batt, {
	/**
	* List of styles in the format:
	* 	{
	*		selector: '.container', // Selector as it pretains to batt.find()
	*		... // Everything else is applied to the object that matches the selector
	*	}
	*/
	styles: [],

	/**
	* Apply a style to all elements
	* @param string selector The selector to apply stylist to
	* @return object This chainable object
	*/
	addStyle: function(selector, style) {
		style.selector = selector;
		this.styles.push(style);
		return this;
	},

	/**
	* Apply a style to an object
	* If stylist has already applied a style it will be skipped next time
	* @param object obj The Batt object to apply the style to
	* @param object style The style hash to apply to the object
	* @return object This chainable object
	*/
	stylistApply: function(obj, style) {
		if (obj.stylist) // Skip process if we've already been here
			return;
		$.extend(obj, style, {stylist: true}); // FIXME: This should be extended to auto-add children etc.
		obj.setup.call(obj);
		var objParent = obj.parent.call(obj);
		if (objParent) // Has a parent (it might be the top level form)?
			objParent.render.call(objParent);
		return this;
	},

	/**
	* Scan all objects and apply styles as needed
	* @return object This chainable object
	*/
	stylist: function() {
		for (var s in batt.styles) {
			var objects = batt.find(batt.styles[s].selector);
			for (var o in objects)
				batt.stylistApply(objects[o], batt.styles[s]);
		}
	}
});

});
