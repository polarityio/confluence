'use strict'
polarity.export = PolarityComponent.extend({
  data: Ember.computed.alias('block.data.details')
});