const RDFProcessor = require('../src/rdfxmlprocessor.js');
const {DOMParser} = require('xmldom');
const assert = require('assert');

describe('Parse demo XML file', () => {
  const dom = new DOMParser().parseFromString(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:ex="http://example.org/stuff/1.0/">
  <rdf:Description rdf:about="http://www.w3.org/TR/rdf-syntax-grammar"
		   dc:title="RDF/XML Syntax Specification (Revised)">
    <ex:editor>
      <rdf:Description ex:fullName="Dave Beckett">
	<ex:homePage rdf:resource="http://purl.org/net/dajobe/" />
      </rdf:Description>
    </ex:editor>
  </rdf:Description>
</rdf:RDF>`);
  
  it("should yield 4 triples", function (done) {
    const parser = new RDFProcessor();
    var count = 0;
    parser.parse(dom, 'https://example.org/', '', function (triple) {
      //Flags end of the triples
      if (!triple) {
        assert.equal(count, 4);
        done();
      }
      count ++;
    });
  });  
});

describe('Parse XML file with a sequence in it', () => {
  const dom = new DOMParser().parseFromString(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Seq rdf:about="http://example.org/favourite-fruit">
    <rdf:li rdf:resource="http://example.org/banana"/>
    <rdf:li rdf:resource="http://example.org/apple"/>
    <rdf:li rdf:resource="http://example.org/pear"/>
  </rdf:Seq>
</rdf:RDF>`);
  it("should yield 4 triples", function (done) {
    const parser = new RDFProcessor();
    var count = 0;
    parser.parse(dom, 'https://example.org/', '', function (triple) {
      //Flags end of the triples
      if (!triple) {
        assert.equal(count, 4);
        done();
      }
      count ++;
    });
  });  
});

describe('Parse XML file with a collection in it', () => {
  const dom = new DOMParser().parseFromString(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:ex="http://example.org/stuff/1.0/">
  <rdf:Description rdf:about="http://example.org/basket">
    <ex:hasFruit rdf:parseType="Collection">
      <rdf:Description rdf:about="http://example.org/banana"/>
      <rdf:Description rdf:about="http://example.org/apple"/>
      <rdf:Description rdf:about="http://example.org/pear"/>
    </ex:hasFruit>
  </rdf:Description>
</rdf:RDF>`);
  it("should yield 7 triples", function (done) {
    const parser = new RDFProcessor();
    var count = 0;
    parser.parse(dom, 'https://example.org/', '', function (triple) {
      if (!triple) {
        assert.equal(count, 7);
        done();
      }
      count ++;
    });
  });  
});  


