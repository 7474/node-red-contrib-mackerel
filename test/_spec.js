var should = require("should");
var helper = require("node-red-node-test-helper");
var lowerNode = require("../mackerel.js");

helper.init(require.resolve('node-red'));

describe('mackerel Node', function () {

  afterEach(function () {
    helper.unload();
  });

  it('should be loaded', function (done) {
    var flow = [{ id: "n1", type: "mackerel", name: "test name" }];
    helper.load(lowerNode, flow, function () {
      var n1 = helper.getNode("n1");
      n1.should.have.property('name', 'test name');
      done();
    });
  });

});