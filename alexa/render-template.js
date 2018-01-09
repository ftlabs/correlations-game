

function renderListItems(items) {
    return items.map((x) => {
        return {
            "token": x,
            "textContent": {
                "primaryText":
                    {
                        "text": `<font size = '5'>${x}</font>`,
                        "type": "RichText"
                    }
            }
        }
    })
}

module.exports = {
    renderListItems
}