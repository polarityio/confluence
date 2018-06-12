'use strict'
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),

  allSpaces: Ember.computed('details.space', function() {
    let space = Ember.A();
    if (this.get('details.space')) {
      space.push("Number of Spaces: " + this.get('details.space').length);
    }
    return space;
  }),
  allPages: Ember.computed('details.page', function() {
    let pages = Ember.A();
    if (this.get('details.page')) {
      pages.push("Number of Pages: " + this.get('details.page').length);
    }
    return pages;
  }),
  allBlogs: Ember.computed('details.blog', function() {
    let blogs = Ember.A();
    if (this.get('details.blog')) {
      blogs.push("Number of Blogs: " + this.get('details.blog').length);
    }
    return blogs;
  })
});
