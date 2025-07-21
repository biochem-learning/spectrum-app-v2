/**
 * @fileoverview Utility functions for DOM manipulation, drag/drop interactions,
 * molecule parsing, and general helper methods.
 *
 * Includes:
 * - DOM utilities (show/hide elements, draggable support)
 * - Event handlers (pair selection, clickout)
 * - Molecular data processing (Molblock parsing, bond analysis)
 * - General helpers (percentage calculations, fetch data)
 *
 * @author Anh Vu
 * @version 1.0.0
 * @date 2025-07-16
 */


/**
 * Toggles visibility of a target element and optionally updates a button's label.
 *
 * @param {string} buttonSelector - CSS selector for the button to update.
 * @param {string} elementSelector - CSS selector for the element to show/hide.
 * @param {boolean} [buttonTextInstruction=false] - If true, changes button text.
 * @param {string} [elementName=""] - Name to display in the button label.
 */
function displayOrHideElement(buttonSelector, elementSelector, buttonTextInstruction = false, elementName = "") {
    const button = document.querySelector(buttonSelector);
    const element = document.querySelector(elementSelector);

    if (!button) {
        console.error(`Button with selector "${buttonSelector}" not found.`);
        return;
    }
    if (!element) {
        console.error(`Element with selector "${elementSelector}" not found.`);
        return;
    }

    const isVisible = window.getComputedStyle(element).display === "block";

    element.style.display = isVisible ? "none" : "block";

    if (buttonTextInstruction) {
        button.innerText = (isVisible ? "Open " : "Close ") + elementName;
    } else {
        console.error("One of two arguements buttonTextInstruction or elementName is missing while the other is present")
    }
}

/**
 * Hides an element if it is currently visible and optionally updates a button's text. 
 * 
 * @param {string} elementSelector - CSS selector for the element to hide. 
 * @param {string} [buttonSelector=null] - (Optional) CSS selector for a button whose text should be updated. 
 * @param {string} [buttonText=null] - (Optional) Text to set on the button after hiding the element. 
 */
function clickout(elementSelector, buttonSelector = null, buttonText = null) {
    const element = document.querySelector(elementSelector);

    if (!element) {
        console.error(`Element with selector "${elementSelector}" not found.`);
        return;
    }

    const currentDisplay = window.getComputedStyle(element).display;

    if (currentDisplay === "block") {
        element.style.display = "none";

        if (buttonSelector && buttonText) {
            const button = document.querySelector(buttonSelector);
            if (button) {
                button.innerText = buttonText;
            } else {
                console.warn(`Button with selector "${buttonSelector}" not found.`);
            }
        }
    }
}

/**
 * Makes an element draggable within the viewport, optionally using a header element as the handle.
 *
 * @param {string} elementSelector - CSS selector for the draggable element.
 * @param {string} [headerSelector=null] - CSS selector for a sub-element to use as the drag handle.
 */
function dragMove(elementName, elementHeader) {
    let element = document.querySelector(elementName);

    if (!element) {
        console.error(`Element with selector "${elementName}" not found. Cannot make it draggable.`);
        return;
    }

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    let dragHandle = element;
    if (elementHeader) { 
        const headerElement = document.querySelector(elementHeader);
        if (headerElement) {
            dragHandle = headerElement; 
        } else {
            console.warn(`Element header with selector "${elementHeader}" not found. Using main element as drag handle.`);
        }
    }

    element.style.cursor = 'grab';
    element.style.touchAction = 'none';

    dragHandle.onmousedown = dragStart;   
    dragHandle.ontouchstart = dragStart;

    function dragStart(e) {
        e = e || window.event;
        e.preventDefault(); 

        let currentClientX, currentClientY;
        if (e.type === 'touchstart') {
            const touch = e.touches[0];
            currentClientX = touch.clientX;
            currentClientY = touch.clientY;
        } else { 
            currentClientX = e.clientX;
            currentClientY = e.clientY;
        }

        pos3 = currentClientX; 
        pos4 = currentClientY; 

        if (e.type === 'touchstart') {
            document.ontouchend = dragEnd;
            document.ontouchmove = elementDrag;
        } else {
            document.onmouseup = dragEnd;
            document.onmousemove = elementDrag;
        }

        element.style.cursor = 'grabbing'; 
    }

    function elementDrag(e) {
        e = e || window.event;

        let currentClientX, currentClientY;
        if (e.type === 'touchmove') {
            e.preventDefault(); 
            const touch = e.touches[0];
            currentClientX = touch.clientX;
            currentClientY = touch.clientY;
        } else { // mousemove
            currentClientX = e.clientX;
            currentClientY = e.clientY;
        }

        pos1 = pos3 - currentClientX;
        pos2 = pos4 - currentClientY;

        pos3 = currentClientX;
        pos4 = currentClientY;

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

        const elementWidth = element.offsetWidth;
        const elementHeight = element.offsetHeight;

        const minX = 0;
        const minY = 0;
        const maxX = viewportWidth - elementWidth;
        const maxY = viewportHeight - elementHeight;

        newLeft = Math.max(minX, Math.min(newLeft, maxX));
        newTop = Math.max(minY, Math.min(newTop, maxY));

        element.style.top = newTop + "px";
        element.style.left = newLeft + "px";
    }

    function dragEnd() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

/**
 * Handles selecting two SVG elements inside a canvas and performs a callback on them.
 * 
 * Adds mouse event listeners to a canvas element. When the user clicks on two different
 * SVG elements in sequence (mousedown and mouseup), the provided callback function is 
 * called with the two selected elements as arguments. After the callback, the selection resets.
 * 
 * @param {function(HTMLElement, HTMLElement): void} callback - Function to execute when two SVG elements are selected. Receives the two selected elements as parameters.
 * @param {string} [canvasSelector="#frag-canvas"] - CSS selector for the canvas element that contains the SVG elements. Defaults to "#frag-canvas".
 */
function handleSvgPairSelection(callback, canvasSelector = "#frag-canvas") {
    let selected1 = null;
    let selected2 = null;
    const canvas = document.querySelector(canvasSelector);

    if (!canvas) {
        console.error(`Canvas with selector "${canvasSelector}" not found.`);
        return;
    }

    canvas.addEventListener("mousedown", (event) => {
        const target = event.target.closest("svg");
        if (target) {
            selected1 = target;
            console.log("Selected 1:", selected1);
        }
    });

    canvas.addEventListener("mouseup", (event) => {
        const target = event.target.closest("svg");
        if (target) {
            selected2 = target;
            console.log("Selected 2:", selected2);

            if (selected1 && selected2 && selected1 !== selected2) {
                try {
                    callback(selected1, selected2);
                } catch (err) {
                    console.error("Callback error:", err);
                }
                selected1 = null;
                selected2 = null;
            }
        }
    });
}

/**
 * Fetches the content of a file from a specified URL and returns it as a plain text string.
 * 
 * Performs an HTTP GET request to the provided path. Throws an error if the request fails.
 * This function is asynchronous and should be used with `await` or `.then()`.
 * 
 * @async
 * @param {string} [path=""] - The URL or path to the file to fetch.
 * @returns {Promise<string>} - The content of the file as a plain text string.
 * 
 * @throws {Error} - If the fetch request fails or returns a non-OK status.
 */
async function getData(path = "") {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - Could not load file from URL.`);
    }

    const contentString = await response.text();
    
    return contentString;
}

/**
 * Fetches and parses a JSON file from a given path.
 * 
 * @param {string} jsonPath - Path or URL to the JSON file.
 * @returns {Promise<Object>} Parsed JSON object.
 * @throws {Error} If the fetch fails or the file contains invalid JSON.
 */
async function getDataJSON(jsonPath) {
    const response = await getData(jsonPath);
    try {
        return JSON.parse(response);
    } catch (err) {
        console.error(`Invalid JSON at ${jsonPath}:`, err);
        throw new Error(`Failed to parse JSON from ${jsonPath}`);
    }
}

/**
 * Gets a DOM element and its parent element.
 * 
 * @param {string} divSelector - CSS selector for the child element.
 * @returns {{element: HTMLElement, parent: HTMLElement} | null} -  An object containing the selected element and its parent, or null if not found.
 */
function getDivAndParentEl(divSelector) {
    let div = document.querySelector(divSelector);

    if (!div) {
        console.error(`Element with selector "${divSelector}" not found.`);
        return null;
    }

    let parent = div.parentNode;
    
    if (!parent) {
        console.error(`Element with selector "${divSelector}" has no parent.`);
        return null;
    }

    return {
        element: div,
        parent: parent

    };
}

/**
 * Calculates a dimension (width or height) as a percentage of a parent element's size.
 * 
 * @param {string} divSelector - CSS selector for the child element.
 * @param {number} percentage - Percentage (0-100) to calculate.
 * @param {"width"|"height"} dimension - The dimension to use ("width" or "height").
 * @returns {number} - The calculated size in pixels.
 */
function percentage(divSelector, percentage, dimension) {
    let divAndParent = getDivAndParentEl(divSelector)

    if (!divAndParent) {
        return
    }

    let parent = divAndParent.parent;

    parentDimension = (dimension === "width") ? parent.offsetWidth : parent.offsetHeight 
    caculatedDimension = parentDimension * percentage / 100;

    return caculatedDimension
}

/**
 * Converts a string into an array of arrays by splitting lines and whitespace.
 * 
 * @param {string} file - The input string (e.g., a text file's contents).
 * @returns {string[][]} - A nested array of strings.
 */
function toArrayOfArrays(file) {
    return file
        .split("\n")                   
        .map(line => line.trim())      
        .filter(line => line.length)  
        .map(line => line.split(/\s+/)); 
}

/**
 * Extracts the bond data section from a Molblock string.
 * 
 * @param {string} molblock - The Molblock text content.
 * @returns {string[][]} Array of bond data rows.
 */
function extractBondData(molblock) {
    let molblockArray = toArrayOfArrays(molblock)
    let numAtomStr = molblockArray[1][0]
    let numAtom = Number(numAtomStr)
    let bondDataArray = molblockArray.slice(numAtom + 2, molblockArray.length - 1);

    return bondDataArray;
}

/**
 * Extracts atom connectivity data from a Molblock string.
 * 
 * @param {string} molblock - The Molblock text content.
 * @returns {string[][]} - Array of connected atom pairs.
 */
function extractBondConnectivityData(molblock) {
    let bondData = extractBondData(molblock); 

    let connectivity = bondData.map(line => line.slice(0, 2));

    return connectivity;
}

/**
 * Flattens a nested array into a single-level array.
 * 
 * @param {any[][]} nestedArray - The nested array to flatten.
 * @returns {any[]} - A flat array.
 */
function toFlatArray(nestedArray) {
    return nestedArray.flat();
}

/**
 * Identifies atoms in a Molblock that have exactly one bond and are carbon atoms (C).
 * 
 * @param {string} molblock - The Molblock text content.
 * @returns {number[]} - Array of atom indices with only one bond.
 */
function getEmptyBondIndex(molblock) {
    const nestedConnectivityData = extractBondConnectivityData(molblock);
    const connectivityData = toFlatArray(nestedConnectivityData).map(Number);
    const molblockArray = toArrayOfArrays(molblock);

    const numAtom = Number(molblockArray[1][0]);

    const emptyBond = [];

    const bondCounts = new Array(numAtom + 1).fill(0); // +1 for 1-based indexing
    for (const atom of connectivityData) {
        bondCounts[atom]++;
    }

    for (let i = 1; i <= numAtom; i++) {
        const atomLine = molblockArray[2 + i - 1]; 
        const atomType = atomLine[3]; 

        if (bondCounts[i] === 1 && atomType === "C") {
            emptyBond.push(i);
            console.log(atomLine[3])
        }
    }

    return emptyBond;
}

function replaceAtomByIndex(molfile, index, newAtom) {
    // Split MOL file into lines
    let lines = molfile.split('\n');

    // Atom and bond counts are on line 4 (index 3)
    let countsLine = lines[3];
    let atomCount = parseInt(countsLine.substring(0, 3));

    // Validate index
    if (index < 1 || index > atomCount) {
        console.error(`Invalid atom index: ${index}`);
        return molfile;
    }

    // Atom block starts at line 4
    let atomLineIndex = 4 + (index - 1);
    let atomLine = lines[atomLineIndex];

    // Replace the atom symbol (columns 31–34)
    let newLine = atomLine.substring(0, 31) + newAtom.padEnd(3, ' ') + atomLine.substring(34);
    lines[atomLineIndex] = newLine;

    // Return modified MOL file
    return lines.join('\n');
}


function removeTextWhenMoveout(textBoxEl) {
    textBoxEl.innerText = "";
}
