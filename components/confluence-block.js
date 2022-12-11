'use strict'
polarity.export = PolarityComponent.extend({
  data: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  })
});