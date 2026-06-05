const { Storage } = require("@google-cloud/storage")

// Creates a client
const storage = new Storage()

const generateV4ReadSignedUrl = async (bucketName, fileName) => {
  // These options will allow temporary read access to the file
  const options = {
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 1000, // 1 minutes
  }

  // Get a v4 signed URL for reading the file
  const [url] = await storage
    .bucket(bucketName)
    .file(fileName)
    .getSignedUrl(options)

  return url
}

const ALGOS = ["movenet", "posenet", "yolo"]

const getRandomArrayElement = (array) => {
  return array[Math.floor(Math.random() * array.length)]
}

const readPoseJSON = async (bucketName, fileName) => {
  try {
    // const filePath = `${getRandomArrayElement(ALGOS)}/${fileName}`
    const filePath = fileName
    console.log(filePath)
    const json = await storage.bucket(bucketName).file(filePath).download()
    return JSON.parse(json.toString())
  } catch (e) {
    console.error(e)
    return e
  }
}

const uploadFile = async (bucketName, fileName, fileContent) => {
  try {
    await storage.bucket(bucketName).file(fileName).save(fileContent)
    console.log("UPLOADED")
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}

module.exports = { generateV4ReadSignedUrl, readPoseJSON, uploadFile }
