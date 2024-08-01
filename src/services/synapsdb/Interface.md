# SynapsDB interface draft


## Main

### CRUD methods
- insertDocument(document, contextArray, featureArray, options = { version, ...})
- insertDocumentArray(documentArray, contextArray, featureArray, options = {})
- removeDocument(id)
- removeDocumentArray(idArray)
- deleteDocument(id)
- deleteDocumentArray(idArray)
- listDocuments(contextArray, featureArray, filterArray, options = {})

### Features

- tickFeature(documentId, featureId)
- tickFeatureArray(documentId, featureArray)
- queryDocument(query)


## Bitmaps

tickRow(idArray)
untickRow(idArray)


