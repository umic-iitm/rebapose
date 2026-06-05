const express = require("express")
const morgan = require("morgan")
const cors = require("cors")
const { Timestamp } = require("@google-cloud/firestore")
const { nanoid } = require("nanoid")

require("dotenv").config()

const app = express()

app.use(express.static("./build"))
app.use(express.json())
app.use(morgan("dev"))
app.use(cors())

app.get("/api/health", (req, res) => {
  res.status(200).json({ health: "OK" })
})

const {
  collectionRef,
  incrementAnnotateCount,
  updateAccessTimestamp,
} = require("./db/firestore")
const {
  generateV4ReadSignedUrl,
  readPoseJSON,
  uploadFile,
} = require("./storage/storage")

app.get("/api/image/new", async (req, res) => {
  const { startAfter } = req.query
  console.log(startAfter)
  try {
    let doc = null
    if (startAfter) {
      doc = await collectionRef
        .where("hidden", "==", false)
        .orderBy("json_name")
        .startAfter(startAfter)
        .limit(1)
        .get()
    } else {
      doc = await collectionRef
        .where("hidden", "==", false)
        .orderBy("json_name")
        .limit(1)
        .get()
    }

    if (doc.empty)
      return res.status(404).json({ err: "Image not found", end: true })

    const file = doc.docs[0]

    const id = file.id
    const image_id = file.get("image_id")
    const json_name = file.get("json_name")

    if (!(await updateAccessTimestamp(id)))
      return res.status(400).json({ err: "Failed to update document" })

    const signedURL = await generateV4ReadSignedUrl(
      process.env.POSE_DATASET_IMAGE,
      `${image_id}.jpg`
    )
    const json = await readPoseJSON(process.env.POSE_DATASET_INPUT, json_name)

    const respose_json = {
      id,
      image_id: image_id,
      name: `${image_id}.jpg`,
      json_name: json_name,
      signedURL,
      borderBox: json.bbox,
      json: json.keypoints,
    }

    console.log(JSON.stringify(respose_json))

    return res.status(200).json(respose_json)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ err })
  }
})

app.post("/api/image/save", async (req, res) => {
  const { id, image_id, json_name, json } = req.body

  const blob = Buffer.from(
    JSON.stringify({ image_id, json_name, key_points: json }),
    "utf8"
  )

  try {
    const fileUploaded = await uploadFile(
      process.env.POSE_DATASET_OUTPUT,
      `${json_name.slice(0, json_name.lastIndexOf("."))} (${nanoid(5)}).json`,
      blob
    )
    const annotatedIncremented = await incrementAnnotateCount(id)

    if (fileUploaded && annotatedIncremented) {
      console.log({ id, image_id, json_name, json })
      return res
        .status(201)
        .json({ success: fileUploaded && annotatedIncremented })
    }
    return res
      .status(400)
      .json({ success: fileUploaded && annotatedIncremented })
  } catch (e) {
    console.log(e)
    return res.status(500).json({ err: "Internal Server Error" })
  }
})

app.get("/api/image/:image_id", async (req, res) => {
  const { image_id } = req.params
  try {
    let doc = await collectionRef.where("image_id", "==", image_id).get()

    if (doc.empty)
      return res.status(404).json({ err: "Image not found", end: true })

    const files = doc.docs.map((e) => {
      return {
        id: e.id,
        image_id: e.get("image_id"),
        json_name: e.get("json_name"),
        // json_bucket: e.get("json_bucket"),
      }
    })

    return res.status(200).json(files)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ err })
  }
})

app.get("/api/image/json/:json_name", async (req, res) => {
  const { json_name } = req.params

  const input_json = await readPoseJSON(
    process.env.POSE_DATASET_INPUT,
    json_name
  )
  if (input_json instanceof Error) {
    return res.status(404).json({ err: `${json_name} not found` })
  }

  const signedURL = await generateV4ReadSignedUrl(
    process.env.POSE_DATASET_IMAGE,
    `${input_json.image_id}.jpg`
  )

  const respose_json = {
    image_id: input_json.image_id,
    name: `${input_json.image_id}.jpg`,
    json_name: json_name,
    signedURL,
    borderBox: input_json.bbox,
    json: input_json.keypoints,
  }

  const output_json = await readPoseJSON(
    process.env.POSE_DATASET_OUTPUT,
    json_name
  )
  if (output_json instanceof Error) {
    return res.status(200).json(respose_json)
  } else {
    return res
      .status(200)
      .json({ ...respose_json, json: output_json["key_points"] })
  }
})

app.listen(8080, () => {
  console.log("Server listening on port 8080")
})
