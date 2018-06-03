# RDF/XML parser

This library processes RDF/XML from an XML DOM. It returns [RDFJS compliant triples](http://rdf.js.org/).

## Use

Install it through NPM:
```bash
npm i rdfxmlprocessor
```

Then use it in your code as follows:

```javascript
const RDFXMLProcessor = require('rdfxmlprocessor');
const {DataFactory} = require('n3');
const {DOMParser} = require('xmldom'); //Or just DOMParser in the browser

//You can choose your own data factory (useful if, among others, you’re using different RDFJS compliant parsers and they each parse blanknodes).
var parser = new RDFXMLProcessor(DataFactory);
try {
    parser.parse(new DOMParser().parseFromString(`<?xml version="1.0"?>
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
  </rdf:RDF>`), 'http://example.org/baseuri/', 'http://example.org/graphname', function (triple) {
    if (triple)
      console.log(triple);
});
} catch (e) {
    console.trace(e);
}
```

You can also use it in your browserify or webpack projects.

## Tests

You need to have mocha installed globally (`npm i -g mocha`).

## Limitations

As it relies on a DOM tree, the size of the XML document to be read is limited to the size of your memory.

## Authors and copyright

This library has been split off from the librdf.js project by timbl and contributors. The RDF/XML processor was originally written by David Sheets. Pieter Colpaert adapted the processor to be RDFJS compliant.

MIT license
