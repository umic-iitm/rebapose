const { Firestore, FieldValue } = require("@google-cloud/firestore")

// Create a new client
const firestore = new Firestore()

const collectionRef = firestore.collection("/pose-dataset-test")

const incrementAnnotateCount = async (id) => {
  try {
    await collectionRef.doc(id).update({
      annotated: FieldValue.increment(1),
    })
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}

const updateAccessTimestamp = async (id) => {
  try {
    await collectionRef.doc(id).update({
      accessedAt: FieldValue.serverTimestamp(),
    })
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}

module.exports = {
  collectionRef,
  incrementAnnotateCount,
  updateAccessTimestamp,
}
