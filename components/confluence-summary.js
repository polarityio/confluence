'use strict'
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details.body'),
  allTitles: Ember.computed('details', function() {
    let title = Ember.A();
    if (this.get('details.results')) {
      title.push("Number of hits: " + this.get('details.results').length);
    }
    return title;
  })
});