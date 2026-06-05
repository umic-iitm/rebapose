import axios from "axios"
import { useEffect, useState } from "react"
import { IoSearch } from "react-icons/io5"

const ViewAnnotation = ({ searchImageByJsonName }) => {
  const [searchInput, setSearchInput] = useState("")
  const [searchResult, setSearchResult] = useState([])
  const [selectedSearchResult, setSelectedSearchResult] = useState(null)

  useEffect(() => {
    console.log(selectedSearchResult)
    if (selectedSearchResult) {
      searchImageByJsonName(
        selectedSearchResult["id"],
        selectedSearchResult["json_name"]
      )
    }
  }, [selectedSearchResult])

  useEffect(() => {
    console.log(searchResult)
    if (searchResult.length !== 0) {
      setSelectedSearchResult(searchResult[0])
    }
  }, [searchResult])

  const handleSearch = (e) => {
    e.preventDefault()
    axios
      .get(`/api/image/${searchInput}`)
      .then((res) => res.data)
      .then((data) => setSearchResult(data))
      .catch((err) => console.error(err))
  }

  return (
    <div
      style={{
        fontFamily: "Poppins",
        fontSize: 11,
        color: "#004745",
        padding: "4px 8px",
        border: "1px solid #05c8c1",
        borderRadius: 4,
      }}
    >
      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          alignItems: "center",
        }}
      >
        <input
          style={{ flexGrow: 1 }}
          type="text"
          placeholder="Enter Image ID"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit">
          <IoSearch size={16} />
        </button>
      </form>
      {searchResult.map((e) => (
        <div
          key={e["json_name"]}
          style={{ margin: "2px 0", cursor: "pointer" }}
          onClick={() => setSelectedSearchResult(e)}
        >
          {" "}
          {e["json_name"] === selectedSearchResult?.json_name
            ? "-> "
            : null}{" "}
          {e["json_name"]}
        </div>
      ))}
    </div>
  )
}

export default ViewAnnotation
