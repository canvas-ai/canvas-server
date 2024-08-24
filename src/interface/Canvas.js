





class CanvasInterface {


    constructor() {
        this.index = new Index();
        this.storage = new Storage();
    }


    insertDocument(document, contextArray, featureArray, backends = []) { }

    listDocuments(contextArray, featureArray, filterArray, backends = []) { }

    getDocument(id, contextArray, featureArray, filterArray) { }

    getDocumentByChecksum(algo, checksum, contextArray, featureArray, filterArray) { }

    hasDocument(id, contextArray, featureArray, filterArray) { }

    hasDocumentByChecksum(algo, checksum, contextArray, featureArray, filterArray) { }

    findDocuments(query, contextArray, featureArray, filterArray) { }

    // ...

    insertFile(filePath, contextArray, featureArray, backends = []) { }

    insertNote(note, contextArray, featureArray, backends = []) { }

    insertTab(tab, contextArray, featureArray, backends = []) { }

    insertTodo(todo, contextArray, featureArray, backends = []) { }

    // ...
}
