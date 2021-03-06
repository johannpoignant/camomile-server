/*
The MIT License (MIT)

Copyright (c) 2013-2015 CNRS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var historySchema = require('./History');
var SSEChannels = require('../lib/SSEChannels');

var mediumSchema = Schema({
  id_corpus: {
    type: Schema.Types.ObjectId,
    ref: 'Corpus'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: Schema.Types.Mixed,
    'default': ''
  },
  url: {
    type: String,
    default: ""
}, history: [historySchema]
});

mediumSchema.methods.getPermissions = function (callback) {
  return this.model('Corpus').findById(
    this.id_corpus,
    function (error, corpus) {
      if (error) {
        callback(error, {
          users: {},
          groups: {}
        });
      } else {
        callback(error, corpus.permissions);
      }
    });
};

mediumSchema.statics.create = function (id_user, id_corpus, data, callback) {

  if (
    data.name === undefined ||
    data.name === '') {
    callback('Invalid name.', null);
    return;
  }

  var medium = new this({
    id_corpus: id_corpus,
    name: data.name,
    description: data.description,
    url: data.url,
    history: [{
      data: new Date(),
      id_user: id_user,
      changes: {
        name: data.name,
        description: data.description,
        url: data.url
      }
    }]
  });

  medium.save(function (error, medium) {
    if (!error) {
      medium.history = undefined;
      medium.__v = undefined;
      SSEChannels.dispatch('corpus:' + id_corpus, { corpus: id_corpus, event: {add_medium: medium._id} });
    }
    callback(error, medium);
  });

};

mediumSchema.statics.removeWithEvent = function(datas, callback) {
  var t = this;

  t.findById(datas._id, function(err, medium) {
    t.remove(datas, function(err) {
      if (err) {
        callback(err);
        return;
      }

      SSEChannels.dispatch('corpus:' + medium.id_corpus, { corpus: medium.id_corpus, event: {delete_medium: medium._id} });
      callback();
    });
  });
};

// SSE Event
mediumSchema.post('save', function(doc) {
  if (doc.history.length > 0) {
    SSEChannels.dispatch('medium:' + doc._id, {medium: doc._id, event: {update: Object.keys(doc.history.pop().changes)} });
  }
});

module.exports = mongoose.model('Medium', mediumSchema);