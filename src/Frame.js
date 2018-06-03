const uriUtil = {
  join : require('./uri-join.js')
};

module.exports = class {

  constructor (parser, parent, element) {
    this.ns = parser.ns
    this.NODE = 1
    this.ARC = 2
    this.parent = parent
    this.parser = parser
    this.factory = parser.factory
    this.element = element
    this.lastChild = 0
    this.base = null
    this.lang = null
    this.node = null
    this.nodeType = null
    this.listIndex = 1
    this.rdfid = null
    this.datatype = null
    this.collection = false
    this.restTriple = null
  }
  
  /** Terminate the frame and notify the store that we're done */
  terminateFrame () {
    //Close the collection if needed with an rdf:nil
    if (this.collection) {
      this.parser.writeTriple(this.parser.restTriple.s, this.parser.restTriple.p, this.ns.RDF + 'nil', this.parser.restTriple.g);
    }
  }

  /** Add a symbol of a certain type to the this frame */
  addSymbol (type, uri) {
    uri = uriUtil.join(uri, this.base)
    this.node = this.factory.namedNode(uri)
    this.nodeType = type
  }

  /** Load any constructed triples into the store */
  loadTriple () {
    if (this.parent.parent.collection) {
      //On the second element, there will be a restTriple
      if (this.parser.restTriple) {
        //If there’s a previous element, we need to link it to the current blanknode
        this.parser.writeTriple(this.parser.restTriple.s, this.parser.restTriple.p, this.parser.restTriple.o, this.parser.restTriple.g);
        //and print the next one as well
      }
      
      this.parser.writeTriple(this.parent.parent.node, this.ns.RDF + 'first', this.node, this.parser.why)
      
      //create new blankNode for the next element - this  will create a blanknode too many though
      var next = this.factory.blankNode()
      this.parser.restTriple = { s: this.parent.parent.node, p: this.ns.RDF + 'rest', o: next, g: this.parser.why}
      this.parent.parent.node = next
    } else {
      this.parser.writeTriple(this.parent.parent.node, this.parent.node, this.node, this.parser.why)
    }
    if (this.parent.rdfid != null) {
      // reify
      var triple = this.factory.namedNode(uriUtil.join('#' + this.parent.rdfid, this.base))
      this.parser.writeTriple(triple, this.factory.namedNode(this.ns.RDF + 'type'), this.factory.namedNode(this.ns.RDF + 'Statement'), this.parser.why)
      this.parser.writeTriple(triple, this.factory.namedNode(this.ns.RDF + 'subject'), this.parent.parent.node, this.parser.why)
      this.parser.writeTriple(triple, this.factory.namedNode(this.ns.RDF + 'predicate'), this.parent.node, this.parser.why)
      
      this.parser.writeTriple(triple, this.factory.namedNode(this.ns.RDF + 'object'), this.node, this.parser.why)
    }
  }

  /** Check if it's OK to load a triple */
  isTripleToLoad () {
    return (this.parent != null && this.parent.parent != null && this.nodeType === this.NODE && this.parent.nodeType === this.ARC && this.parent.parent.nodeType === this.NODE) 
  }

  /** Add a symbolic node to this frame */
  addNode (uri) {
    this.addSymbol(this.NODE, uri)
    if (this.isTripleToLoad()) {
      this.loadTriple()
    }
  }

  /** Add a collection node to this frame */
  addCollection () {
    this.nodeType = this.NODE
    //this.node = this.store.collection()
    this.node = this.factory.blankNode()
    this.collection = true
    if (this.isTripleToLoad()) {
      this.loadTriple()
    }
  }

  /** Add a collection arc to this frame */
  addCollectionArc () {
    this.nodeType = this.ARC
  }

  /** Add a bnode to this frame */
  addBNode (id) {
    if (id != null) {
      if (this.parser.bnodes[id] != null) {
        this.node = this.parser.bnodes[id]
      } else {
        this.node = this.parser.bnodes[id] = this.factory.blankNode()
      }
    } else {
      this.node = this.factory.blankNode()
    }
    this.nodeType = this.NODE
    if (this.isTripleToLoad()) {
      this.loadTriple()
    }
  }

  /** Add an arc or property to this frame */
  addArc (uri) {
    if (uri === this.ns.RDF + 'li') {
      uri = this.ns.RDF + '_' + this.parent.listIndex
      this.parent.listIndex++
    }
    
    this.addSymbol(this.ARC, uri)
  }

  /** Add a literal to this frame */
  addLiteral (value) {
    if (this.parent.datatype) {
      this.node = this.factory.literal(value, '', this.parent.datatype)
    } else {
      this.node = this.factory.literal(value, this.lang)
    }
    this.nodeType = this.NODE
    if (this.isTripleToLoad()) {
      this.loadTriple()
    }
  }
}
