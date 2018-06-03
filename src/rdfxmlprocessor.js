/**
 * @fileoverview
 *  RDF/XML PARSER
 *
 * Version 0.1
 *  Parser believed to be in full positive RDF/XML parsing compliance
 *  with the possible exception of handling deprecated RDF attributes
 *  appropriately. Parser is believed to comply fully with other W3C
 *  and industry standards where appropriate (DOM, ECMAScript, &c.)
 *
 *  Author: David Sheets <dsheets@mit.edu>
 *
 * W3C® SOFTWARE NOTICE AND LICENSE
 * http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231
 * This work (and included software, documentation such as READMEs, or
 * other related items) is being provided by the copyright holders under
 * the following license. By obtaining, using and/or copying this work,
 * you (the licensee) agree that you have read, understood, and will
 * comply with the following terms and conditions.
 *
 * Permission to copy, modify, and distribute this software and its
 * documentation, with or without modification, for any purpose and
 * without fee or royalty is hereby granted, provided that you include
 * the following on ALL copies of the software and documentation or
 * portions thereof, including modifications:
 *
 * 1. The full text of this NOTICE in a location viewable to users of
 * the redistributed or derivative work.
 * 2. Any pre-existing intellectual property disclaimers, notices, or terms and
 * conditions. If none exist, the W3C Software Short Notice should be
 * included (hypertext is preferred, text is permitted) within the body
 * of any redistributed or derivative code.
 * 3. Notice of any changes or modifications to the files, including the
 * date changes were made. (We recommend you provide URIs to the location
 * from which the code is derived.)
 *
 * THIS SOFTWARE AND DOCUMENTATION IS PROVIDED "AS IS," AND COPYRIGHT
 * HOLDERS MAKE NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO, WARRANTIES OF MERCHANTABILITY OR FITNESS
 * FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE SOFTWARE OR
 * DOCUMENTATION WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS,
 * TRADEMARKS OR OTHER RIGHTS.
 *
 * COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, SPECIAL
 * OR CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE SOFTWARE OR
 * DOCUMENTATION.
 *
 * The name and trademarks of copyright holders may NOT be used in
 * advertising or publicity pertaining to the software without specific,
 * written prior permission. Title to copyright in this software and any
 * associated documentation will at all times remain with copyright
 * holders.
 */

/**
 * @class Class defining an RDFParser resource object tied to an RDFStore
 *
 * @author David Sheets <dsheets@mit.edu>
 * @version 0.1
 *
 */

const uriUtil = {
  join : require('./uri-join.js')
};

const Frame = require('./Frame.js');
const DataFactory = require('n3').DataFactory;

class RDFXMLProcessor {

  /**
   *
   * @constructor
   * @param {RDFJS.DataFactory} factory An RDFJS Factory object that creates the right objects
   */
  constructor (factory) {
    if (factory) {
      this.factory = factory;
    } else {
      this.factory = DataFactory;
    }
    
    /** 
     * Standard namespaces that we know how to handle @final
     */
    this.ns = {'RDF': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'RDFS': 'http://www.w3.org/2000/01/rdf-schema#'}
    
    /** DOM Level 2 node type magic numbers @final
     *  @member RDFXMLProcessor
     */
    this.nodeType = {'ELEMENT': 1, 'ATTRIBUTE': 2, 'TEXT': 3,
                     'CDATA_SECTION': 4, 'ENTITY_REFERENCE': 5,
                     'ENTITY': 6, 'PROCESSING_INSTRUCTION': 7,
                     'COMMENT': 8, 'DOCUMENT': 9, 'DOCUMENT_TYPE': 10,
                     'DOCUMENT_FRAGMENT': 11, 'NOTATION': 12}
    
    /** Our triple store reference @private */
    this.bnodes = {} /** A context for context-aware stores @private */
    this.why = null /** Reification flag */
    this.reify = false
  }

  // from the OpenLayers source .. needed to get around IE problems.
  getAttributeNodeNS (node, uri, name) {
    var attributeNode = null
    if (node.getAttributeNodeNS) {
      attributeNode = node.getAttributeNodeNS(uri, name)
    } else {
      var attributes = node.attributes
      var potentialNode, fullName
      for (var i = 0;i < attributes.length; ++i) {
        potentialNode = attributes[i]
        if (potentialNode.namespaceURI === uri) {
          fullName = (potentialNode.prefix) ? (potentialNode.prefix + ':' + name) : name
          if (fullName === potentialNode.nodeName) {
            attributeNode = potentialNode
            break
          }
        }
      }
    }
    return attributeNode
  }

  /**
   * Build our initial scope frame and parse the DOM into triples
   * @param {DOMTree} document The DOM to parse
   * @param {String} base The base URL to use
   * @param {Object} why The context to which this resource belongs
   * @param {Function} writeTriple The callback to write a triple to the end-user
   */
  parse (document, base, why, writeTriple) {
    if (!writeTriple) {
      writeTriple = why
      why = this.factory.defaultGraph()
    }
    this.writeTriple = (s,p,o,g) => {
      writeTriple(this.factory.quad(s,p,o,g))
    }
    this.finalize = () => {
      //finalize by sending a null
      writeTriple(null);
    }
    var children = document.childNodes // clean up for the next run
    this.cleanParser() // figure out the root element
    var root
    if (document.nodeType === this.nodeType.DOCUMENT) {
      for (var c = 0;c < children.length;c++) {
        if (children[c].nodeType === this.nodeType.ELEMENT) {
          root = children[c]
          break
        }
      }
    } else if (document.nodeType === this.nodeType.ELEMENT) {
      root = document
    } else {
      throw new Error("RDFXMLProcessor: can't find root in " + base + '. Halting. ')
    // return false
    }
    this.why = why // our topmost frame
    var f = new Frame(this)
    this.base = base
    f.base = base
    f.lang = null // was '' but can't have langs like that 2015 (!)
    this.parseDOM(this.buildFrame(f, root))
  }

  parseDOM (frame) {
    // a DOM utility function used in parsing
    var rdfid
    var elementURI = function (el) {
      var result = ''
      if (el.namespaceURI == null) {
        throw new Error('RDF/XML syntax error: No namespace for ' + el.localName + ' in ' + this.base)
      }
      if (el.namespaceURI) {
        result = result + el.namespaceURI
      }
      if (el.localName) {
        result = result + el.localName
      } else if (el.nodeName) {
        if (el.nodeName.indexOf(':') >= 0)result = result + el.nodeName.split(':')[1]
        else result = result + el.nodeName
      }
      return result
    }.bind(this)
    var dig = true // if we'll dig down in the tree on the next iter
    while (frame.parent) {
      var dom = frame.element
      var attrs = dom.attributes
      if (dom.nodeType === this.nodeType.TEXT || dom.nodeType === this.nodeType.CDATA_SECTION) {
        // we have a literal
        if (frame.parent.nodeType === frame.NODE) {
          // must have had attributes, store as rdf:value
          frame.addArc(this.ns.RDF + 'value')
          frame = this.buildFrame(frame)
        }
        frame.addLiteral(dom.nodeValue)
      } else if (elementURI(dom) !== this.ns.RDF + 'RDF') {
        // not root
        if (frame.parent && frame.parent.collection) {
          // we're a collection element
          frame.addCollectionArc()
          frame = this.buildFrame(frame, frame.element)
          frame.parent.element = null
        }
        if (!frame.parent || !frame.parent.nodeType || frame.parent.nodeType === frame.ARC) {
          // we need a node
          var about = this.getAttributeNodeNS(dom, this.ns.RDF, 'about')
          rdfid = this.getAttributeNodeNS(dom, this.ns.RDF, 'ID')
          if (about && rdfid) {
            throw new Error('RDFXMLProcessor: ' + dom.nodeName + ' has both rdf:id and rdf:about.' +
              ' Halting. Only one of these' + ' properties may be specified on a' + ' node.')
          }
          if (!about && rdfid) {
            frame.addNode('#' + rdfid.nodeValue)
            dom.removeAttributeNode(rdfid)
          } else if (about == null && rdfid == null) {
            var bnid = this.getAttributeNodeNS(dom, this.ns.RDF, 'nodeID')
            if (bnid) {
              frame.addBNode(bnid.nodeValue)
              dom.removeAttributeNode(bnid)
            } else {
              frame.addBNode()
            }
          } else {
            frame.addNode(about.nodeValue)
            dom.removeAttributeNode(about)
          }
          // Typed nodes
          var rdftype = this.getAttributeNodeNS(dom, this.ns.RDF, 'type')
          if (this.ns.RDF + 'Description' !== elementURI(dom)) {
            rdftype = {'nodeValue': elementURI(dom)}
          }
          if (rdftype != null) {
            this.writeTriple(frame.node, this.factory.namedNode(this.ns.RDF + 'type'), this.factory.namedNode(uriUtil.join(rdftype.nodeValue, frame.base)), this.why)
            if (rdftype.nodeName) {
              dom.removeAttributeNode(rdftype)
            }
          }
          // Property Attributes
          for (var x = attrs.length - 1; x >= 0; x--) {
            this.writeTriple(frame.node, this.factory.namedNode(elementURI(attrs[x])), this.factory.literal(attrs[x].nodeValue, frame.lang), this.why)
          }
        } else {
          // we should add an arc (or implicit bnode+arc)
          frame.addArc(elementURI(dom)) // save the arc's rdf:ID if it has one
          if (this.reify) {
            rdfid = this.getAttributeNodeNS(dom, this.ns.RDF, 'ID')
            if (rdfid) {
              frame.rdfid = rdfid.nodeValue
              dom.removeAttributeNode(rdfid)
            }
          }
          var parsetype = this.getAttributeNodeNS(dom, this.ns.RDF, 'parseType')
          var datatype = this.getAttributeNodeNS(dom, this.ns.RDF, 'datatype')
          if (datatype) {
            frame.datatype = datatype.nodeValue
            dom.removeAttributeNode(datatype)
          }
          if (parsetype) {
            var nv = parsetype.nodeValue
            if (nv === 'Literal') {
              frame.datatype = this.ns.RDF + 'XMLLiteral' 
              frame = this.buildFrame(frame)
              // Don't include the literal node, only its children
              frame.addLiteral(dom.childNodes)
              dig = false
            } else if (nv === 'Resource') {
              frame = this.buildFrame(frame, frame.element)
              frame.parent.element = null
              frame.addBNode()
            } else if (nv === 'Collection') {
              frame = this.buildFrame(frame, frame.element)
              frame.parent.element = null
              frame.addCollection()
            }
            dom.removeAttributeNode(parsetype)
          }
          if (attrs.length !== 0) {
            var resource = this.getAttributeNodeNS(dom, this.ns.RDF, 'resource')
            var bnid2 = this.getAttributeNodeNS(dom, this.ns.RDF, 'nodeID')
            frame = this.buildFrame(frame)
            if (resource) {
              frame.addNode(resource.nodeValue)
              dom.removeAttributeNode(resource)
            } else {
              if (bnid2) {
                frame.addBNode(bnid2.nodeValue)
                dom.removeAttributeNode(bnid2)
              } else {
                frame.addBNode()
              }
            }
            for (var x1 = attrs.length - 1; x1 >= 0; x1--) {
              var f = this.buildFrame(frame)
              f.addArc(elementURI(attrs[x1]))
              if (elementURI(attrs[x1]) === this.ns.RDF + 'type') {
                (this.buildFrame(f)).addNode(attrs[x1].nodeValue)
              } else {
                (this.buildFrame(f)).addLiteral(attrs[x1].nodeValue)
              }
            }
          } else if (dom.childNodes.length === 0) {
            (this.buildFrame(frame)).addLiteral('')
          }
        }
      } // rdf:RDF
      // dig dug
      dom = frame.element
      while (frame.parent) {
        var pframe = frame
        while (dom == null) {
          frame = frame.parent
          dom = frame.element
        }
        var candidate = dom.childNodes && dom.childNodes[frame.lastChild]
        if (!candidate || !dig) {
          frame.terminateFrame()
          if (!(frame = frame.parent)) {
            break
          } // done
          dom = frame.element
          dig = true
        } else if ((candidate.nodeType !== this.nodeType.ELEMENT &&
          candidate.nodeType !== this.nodeType.TEXT &&
          candidate.nodeType !== this.nodeType.CDATA_SECTION) ||
          ((candidate.nodeType === this.nodeType.TEXT ||
          candidate.nodeType === this.nodeType.CDATA_SECTION) &&
          dom.childNodes.length !== 1)) {
          frame.lastChild++
        } else {
          // not a leaf
          frame.lastChild++
          frame = this.buildFrame(pframe, dom.childNodes[frame.lastChild - 1])
          break
        }
      }
    } // while
    //finalize the output
    this.finalize();
  }

  /**
   * Cleans out state from a previous parse run
   * @private
   */
  cleanParser () {
    this.bnodes = {}
    this.why = null
  }

  /**
   * Builds scope frame
   * @private
   */
  buildFrame (parent, element) {
    var frame = new Frame(this, parent, element)
    if (parent) {
      frame.base = parent.base
      frame.lang = parent.lang
    }
    if (!element || element.nodeType === this.nodeType.TEXT ||
      element.nodeType === this.nodeType.CDATA_SECTION) {
      return frame
    }
    var attrs = element.attributes
    var base = element.getAttributeNode('xml:base')
    if (base != null) {
      frame.base = base.nodeValue
      element.removeAttribute('xml:base')
    }
    var lang = element.getAttributeNode('xml:lang')
    if (lang != null) {
      frame.lang = lang.nodeValue
      element.removeAttribute('xml:lang')
    }
    // remove all extraneous xml and xmlns attributes
    for (var x = attrs.length - 1;x >= 0;x--) {
      if (attrs[x].nodeName.substr(0, 3) === 'xml') {
        if (attrs[x].name.slice(0, 6) === 'xmlns:') {
          var uri = attrs[x].nodeValue
          if (this.base) uri = uriUtil.join(uri, this.base)
          //Do we need this for something?
          //this.store.setPrefixForURI(attrs[x].name.slice(6), uri)
        }
        element.removeAttributeNode(attrs[x])
      }
    }
    return frame
  }
}

module.exports = RDFXMLProcessor
