import Button from "../Button"
import "./SkipDialog.scss"

const SkipDialog = ({
  isLoading,
  isSaving,
  hasReachedEnd,
  setShowSkipDailog,
  nextImage,
  json_name,
}) => {
  return (
    <div className="skip-dailog__backdrop">
      <div className="skip-dailog__body">
        <p>Are you sure you want to skip the image?</p>
        <div style={{ width: "100%", display: "flex" }}>
          <Button
            variant="outline"
            style={{ minHeight: 34, margin: "0 4px" }}
            disabled={isLoading || isSaving || hasReachedEnd}
            onClick={() => setShowSkipDailog(false)}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            style={{ minHeight: 34, margin: "0 4px" }}
            disabled={isLoading || isSaving || hasReachedEnd}
            onClick={() => nextImage(json_name)}
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SkipDialog
