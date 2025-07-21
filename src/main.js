const MOL_CANVAS_WIDTH = 90; ///Change this to percentage(100) for cleaner code
const MOL_CANVAS_HEIGHT = 90; ///Change this to percentage(100) for cleaner code
const SPEC_CANVAS_WIDTH = 95; ///Change this to percentage(100) for cleaner code
const SPEC_CANVAS_HEIGHT = 95; ///Change this to percentage(100) for cleaner code
const USER_CANVAS_WIDTH = 100; ///Change this to percentage(100) for cleaner code
const USER_CANVAS_HEIGHT = 100; ///Change this to percentage(100) for cleaner code

const MOL_CANVAS_ID = "sample_molecule";
const SPEC_CANVAS_ID = "sample_spectrum";

const SPEC_DESCRIPTION_TEXTBOX =  document.querySelector(".spec-desc"); 

let displayingMol = "Ethanol"
let viewingMode = "MS"

let spectraCache = {};

/// Problem: Extreme Inefficient (The App fetch JSON every mousemove)

let canvases = setUpCanvas(
    'data/spectra/' + viewingMode + '/' + displayingMol + viewingMode + '.jdx',
    MOL_CANVAS_ID,
    SPEC_CANVAS_ID,
    MOL_CANVAS_WIDTH,
    MOL_CANVAS_HEIGHT,
    SPEC_CANVAS_WIDTH,
    SPEC_CANVAS_HEIGHT,
);

createCompoundSubmenu("data/spectra/compound-menu.txt")

dragMove(".frag-table", ".f-t-general-instr");

displayGeneralText(displayingMol)

///////////////////////
/// WINDOW BEHAVIORS///
///////////////////////

document.querySelector(".frag-table-button").addEventListener("click", function() {
    event.stopPropagation()
    displayOrHideElement(".frag-table-button", ".frag-table", true, "Fragment Table");
});

document.addEventListener("click", function (event) {
    const clickedElement = event.target;

    if (clickedElement.closest(".frag-table, .user-section, .overlay, .info-section, svg") ||
        clickedElement.id === "del-frag-button") {
        return;
    }

    clickout(".frag-table");
});

document.querySelectorAll(".nav-bar-section").forEach(button => {
    button.addEventListener("click", function() {
        if (this.id === "compounds") {
            displayGeneralText(displayingMol)
            return;
        }
        canvases = setUpCanvas('data/spectra/' + this.id + '/' + displayingMol + this.id + '.jdx',
            MOL_CANVAS_ID,
            SPEC_CANVAS_ID,
            MOL_CANVAS_WIDTH,
            MOL_CANVAS_HEIGHT,
            SPEC_CANVAS_WIDTH,
            SPEC_CANVAS_HEIGHT,
        ) 
        viewingMode = this.id;
        displayGeneralText(displayingMol, this.id)
    });
})

let editMode = false;

function loadFragmentTable() {
    let fragTable = document.querySelector(".frag-table")
    for (let i = 0; i < 9; i++) {
        fetch(`data/frag-library/frag${i}.svg`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to load: " + response.status);
            }
            return response.text(); 
        })
        .then(svgText => {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, "image/svg+xml").documentElement;
            
            svgDoc.addEventListener('mouseover', function() {
                this.style.cursor = 'pointer';
            })

            displayFragIntoCanvas(svgDoc)
            
            fragTable.appendChild(svgDoc);
        })
        .catch(error => {
            console.error("Error loading file: frag" + i + ".svg", error);
        });
    }
}

loadFragmentTable()


function displayFragIntoCanvas(frag) {
    frag.addEventListener("click", function() {
        let fragCanvas = document.querySelector('#frag-canvas');
        let clonedFrag = this.cloneNode(true); 
        clonedFrag.classList.add('frag-canvas-items');
        makeDeletable(clonedFrag)
        fragCanvas.appendChild(clonedFrag);
    });
}

document.querySelector("#del-frag-button").addEventListener("click", function() {
    editMode = toggleMode(editMode);
    displayOrHideElement("#del-frag-button", ".overlay", true, "Frag Edit Mode")
})

    // Wait for RDKit to finish loading
let RDKitLoader = null;

function loadRDKit() {
  if (!RDKitLoader) {
    RDKitLoader = window.initRDKitModule()
      .then((RDKit) => {
        console.log("RDKit version: " + RDKit.version());
        return RDKit;
      })
      .catch((err) => {
        console.error("Failed to load RDKit module.", err);
        throw err;
      });
  }
  return RDKitLoader;
}

async function useRDKit() {
    let RDKit = await loadRDKit();
    const mol = RDKit.get_mol("ClC");
    console.log(mol.get_smiles());
}

useRDKit();

handleSvgPairSelection(mergeImages)

async function mergeImages(selected1, selected2) {
    let RDKit = await loadRDKit()
    const svgString1 = decodeURIComponent(selected1.dataset.smiles);
    const svgString2= decodeURIComponent(selected2.dataset.smiles);

    let arr = svgString1.split("");
    let arr2 = svgString2.split("");

    /// Detemine out of the two which one has more C bond and make that the primary bond
    const carbonCount1 = arr.filter(x => x === "C").length;
    const carbonCount2 = arr2.filter(x => x === "C").length;

    const hydrogenCount = arr.filter(x => x === "H").length + arr2.filter(x => x === "H").length;
    console.log(hydrogenCount)

    let primaryFrag, secondaryFrag;
    if (carbonCount1 < carbonCount2) {
        primaryFrag = svgString2;
        secondaryFrag = svgString1;
        arr = arr2
    } else {
        primaryFrag = svgString1;
        secondaryFrag = svgString2;
    }

    console.log("primaryFrag: " + primaryFrag)
    console.log("secondaryFrag: " + secondaryFrag)

    let spliceIndex = null;

    console.log(arr)

    if (arr[0] === "C" && arr[1] === "C") {
        spliceIndex = 0;
        console.log("Passed to first character");
        console.log(arr[0])
    } else if (arr[arr.length - 1] === "C") {
        spliceIndex = arr.length - 1; 
        console.log("Passed to last character");
    } else {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === "C" && arr[i + 1] === ")") {
            spliceIndex = i;
            console.log("Passed to middle character");
            break;
            }
        }
    }

    if (spliceIndex === null) {
        console.error("No valid splice point found!");
        return;
    }

    const convertedSecondaryFrag = await removeOneBond(secondaryFrag,spliceIndex);

    // Replace at spliceIndex
    arr.splice(spliceIndex, 1, convertedSecondaryFrag);
    console.log("Splice Index = ", spliceIndex)
    let mergedString = arr.join("");
    let smileData = mergedString;

    /// If H >= 0:
    if (hydrogenCount >= 0) {
        /// Remove all [] and replace H by C
        let cleanedStr = mergedString.replace(/\[|\]/g, "").replace(/H/g, "C");
        console.log(cleanedStr)
        /// - Convert mergedString to mol
        let convertedMol = RDKit.get_mol(cleanedStr)
        console.log("convertedMol: " + convertedMol)

        /// - Convert mol to molblock
        let convertedMolBlock = convertedMol.get_molblock()

        /// - Use molblock to find emptyIndex
        let emptyBonds = getEmptyBondIndex(convertedMolBlock)
        console.log("emptyBonds: " + emptyBonds)
        /// - Use emptyIndex to insert H into mol = number of H in both fragments
        console.log("hydrogenCount: " + hydrogenCount)

        let addHMol = convertedMolBlock;
        for (let i = 0; i < hydrogenCount; i += 1) {
            const randomIndex = Math.floor(Math.random() * emptyBonds.length);
            const randomElement = emptyBonds.splice(randomIndex, 1)[0];
            console.log("randomIndex: " + randomElement)

            addHMol = replaceAtomByIndex(addHMol, randomElement, "H")
        }

        console.log("emptyBonds after spliced: " + emptyBonds)
        console.log("addHMol: " + addHMol)

        const finalMol = RDKit.get_mol(addHMol);
        /// - Convert mol to smile
        let smileString = finalMol.get_smiles()

        console.log("smileString: " + smileString)
        /// - Insert smile into svg

        mergedString = addHMol;
        smileData = smileString
    }
    

    console.log("Merged SMILES:", mergedString);

    selected1.remove();
    selected2.remove();

    const mergedMol = RDKit.get_mol(mergedString);
    const mergedSvg = mergedMol.get_svg().replace(
        "<svg",
        `<svg class="merged-svg" data-smiles="${smileData}"`
    );
    let canvas = document.querySelector("#frag-canvas")
    canvas.innerHTML += mergedSvg;

}

async function removeOneBond(SMILEStr, position) {
    let RDKit = await loadRDKit()
    /// convert SMILEstr into molblock
    let mol = RDKit.get_mol(SMILEStr);
    let molblock = mol.get_molblock()
    let emptyBonds = getEmptyBondIndex(molblock)

    console.log("Secondary molblock: " + molblock)
    console.log("Secondary mol empty bond: " + emptyBonds)
    /// get emptyIndex
    let newSmiles;
    /// if postion === 0 (remove lasts):
    if (position == 0) {
    /// if last C is empty bond (last and last-1 === C):
        if (SMILEStr[SMILEStr.length - 1] === "C") {
            ///     delete last C
            newSmiles = SMILEStr.slice(0, -1);
            console.log("1 is run")
        }
        ///   else (not empty last bond):
        else {
            /// move last to an empty bond using emptyIndex by count to the emptyIndex C
            let element;

            if (SMILEStr[SMILEStr.length - 2].toUpperCase() !== "C") {
                // Take the last 2 characters
                element = SMILEStr.slice(SMILEStr.length - 2);
            } else {
                // Otherwise just take the last character
                element = SMILEStr[SMILEStr.length - 1];
            }

            /// Maybe delete one in the molblock
            console.log(element)
        }

    }
    /// else (position !=  0) (remove first):
    else {
        ///   if first C is empty bond (first and first+1 === C):
        if (SMILEStr[0].toUpperCase() === "C") {
            console.log("4 is run")
            /// delete first C
            newSmiles = SMILEStr.slice(1);
    }
    /// else (not empty first bond):
    else {
        /// move first to an empty bond using emptyIndex by count to the emptyIndex C
    }
    }
    // for the second mol the connection point would ALWAYS be the first or last C bond depedning on situation, so if there is 
    // anything that is not C in the first or last position of the secondMOL string, move it to anther bond location
    // if molString2 is merged in the beginning of molString1: remove C at the end
    // if molString2 is merged in the middle or end of molString1: remove C in the beginning
    newSmiles = SMILEStr.slice(0, -1);
    return newSmiles
    console.log("8 is run")
}

function toggleMode(currentMode) {
    return !currentMode;
}

function makeDeletable(element) {
    element.addEventListener('click', function() {
        if (editMode) {
            this.remove(); 
            console.log('Element removed:', this);
        }
    });
}

async function setUpCanvas(path='', molCanvasId, specCanvasId, molWidth, molHeight, specWidth, specHeight) {
    removeCanvas(molCanvasId)
    removeCanvas(specCanvasId)

    let data = await getData(path) 

    let canvas = new ChemDoodle.io.JCAMPInterpreter().makeStructureSpectrumSet(
        'sample', 
        data, 
        percentage("#" + molCanvasId, molWidth, "width"), 
        percentage("#" + molCanvasId, molHeight, "height"), 
        percentage("#" + specCanvasId, specWidth, "width"), 
        percentage("#" + specCanvasId, specHeight, "height"),
    )

    console.log(canvas);
    return canvas;
}

window.addEventListener('resize', function() {
    canvases = setUpCanvas(
        'data/spectra/' + viewingMode + '/' + displayingMol + viewingMode + '.jdx',
        MOL_CANVAS_ID,
        SPEC_CANVAS_ID,
        MOL_CANVAS_WIDTH,
        MOL_CANVAS_HEIGHT,
        SPEC_CANVAS_WIDTH,
        SPEC_CANVAS_HEIGHT
    )
});

function removeCanvas(canvasId) {
	let canvasAndParent = getDivAndParentEl("#" + canvasId);

    if (!canvasAndParent) {
        return
    }

    let canvas = canvasAndParent.element;
    let parent = canvasAndParent.parent;
    let newCanvas = document.createElement("canvas");
    
    newCanvas.id = canvasId;

	parent.replaceChild(newCanvas, canvas);
}

async function createCompoundSubmenu(menuFilePath) {
    const dropdownMenu = document.querySelector(".dropdown");
    if (!dropdownMenu) {
        console.error("Dropdown container '.dropdown' not found.");
        return;
    }

    dropdownMenu.querySelector(".dropdown-content")?.remove();

    const ddContentWrapper = document.createElement("div");
    ddContentWrapper.classList.add("dropdown-content");
    dropdownMenu.appendChild(ddContentWrapper);

    try {
        const response = await fetch(menuFilePath);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const textData = await response.text();
        const itemArray = textData
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean); 

        itemArray.forEach((compoundName, index) => {
            const subItem = document.createElement("a");
            subItem.textContent = compoundName;
            subItem.id = `dropdown-item-${index}`;
            subItem.classList.add('dropdown-item');
            ddContentWrapper.appendChild(subItem);

            subItem.addEventListener('click', (event) => {
                event.preventDefault();

                console.log(`Selected compound: ${compoundName}`);
                displayingMol = compoundName;
                viewingMode = "MS"

                canvases = setUpCanvas(
                    `data/spectra/MS/${compoundName}MS.jdx`,
                    MOL_CANVAS_ID,
                    SPEC_CANVAS_ID,
                    MOL_CANVAS_WIDTH,
                    MOL_CANVAS_HEIGHT,
                    SPEC_CANVAS_WIDTH,
                    SPEC_CANVAS_HEIGHT
                );

                displayGeneralText(compoundName);
            });
        });
    } catch (error) {
        console.error("Error reading menu file:", error);
    }
}

async function getSpectraJSON(molecule) {
    if (spectraCache[molecule]) {
        return spectraCache[molecule];
    }
    const data = await getDataJSON(`data/spectra/spec-description/${molecule}.json`);
    spectraCache[molecule] = data;
    return data;
}

function getSpectraSection(dataJSON, mode) {
    if (!mode) return dataJSON.description;
    return dataJSON?.spectra_info?.[mode]?.general_description || "";
}

async function displayGeneralText(molecule, mode = "", textBoxEl = SPEC_DESCRIPTION_TEXTBOX) {
    const dataJSON = await getSpectraJSON(molecule);
    textBoxEl.innerText = getSpectraSection(dataJSON, mode);
}

async function displayTextWhenHovered(hoveredEl, mode, molecule, textBoxEl) {
    if (!hoveredEl || typeof hoveredEl.x !== "number" || isNaN(hoveredEl.x)) {
        console.error("Invalid hovered object or hovered.x:", hoveredEl);
        return;
    }
    if (!textBoxEl) {
        console.error("Text box element not found.");
        return;
    }

    const dataJSON = await getSpectraJSON(molecule);
    const peaks = dataJSON?.spectra_info?.[mode]?.peaks || [];

    for(let i = 0; i < peaks.length; i += 1)  {
        if (hoveredEl.x == peaks[i].x) { 
            textBoxEl.innerText = peaks[i].description;
        }
    }
}

///////////////////////
/// UNUSED FUNCTION ///
///////////////////////


/// Update these function if need to be used

// async function setupSpectrumInteractivity(canvases, mode, molecule) {
//     try {
//         const canvasesArray = await canvases;

//         const specJSON = await getDataJSON("data/spectra/SpecDescription/" + molecule +".json");

//         let specCanvas = canvasesArray[1];

//         let targetCanvasElement = document.querySelector("#sample_spectrum");

//         targetCanvasElement.addEventListener("mousemove", async function(event) {
//             const xCoordinate = event.offsetX; 

//             let calculatedDataX = convertPxToChem(specCanvas, xCoordinate);
//             // console.log("Real X Coordinate " + xCoordinate)
//             console.log("Converted X Coordinate " + calculatedDataX)

//             displayTextWhenHovered(specJSON, calculatedDataX, mode)
//         });

//     } catch (mainSetupError) {
//         console.error("An error occurred during initial spectrum setup:", mainSetupError);
//     }
// }


// function convertPxToChem(canvas, xCoordinate) {
//     let spectrumData = canvas.spectrum.data;
//     let dataLength = spectrumData.length;
//     // console.log("Total data points:", dataLength);

//     let plotMinDataX = Math.min(spectrumData[0].x, spectrumData[dataLength - 1].x);
//     let plotMaxDataX = Math.max(spectrumData[0].x, spectrumData[dataLength - 1].x);
//     // console.log(spectrumData[0].x)
//     // console.log(spectrumData[dataLength - 1].x)

//     let dataRange = plotMaxDataX - plotMinDataX;
//     // console.log("Data range:", dataRange);

//     let canvasWidth = canvas.width;
//     // console.log("Canvas total pixel width:", canvasWidth);

//     let calculatedDataX = plotMaxDataX - (xCoordinate / canvasWidth) * dataRange;

//     return calculatedDataX.toFixed(0);
// }

// async function displayTextWhenHovered(dataJSON, hoveredX, mode="", elSelector=".spec-desc") {
//     let textBox = document.querySelector(elSelector); 
    
//     try {
//         if (mode === "") {
//             textBox.innerText = dataJSON.description;
//             console.log(dataJSON.general_description);
//         }
//         else {
//             let modeObj;
//             switch (mode) {
//                 case "MS":
//                     modeObj = dataJSON.spectra_info.MS;
//                     break
//                 case "IR":
//                     modeObj = dataJSON.spectra_info.IR;
//                     break
//                 case "HNMR":
//                     modeObj = dataJSON.spectra_info.HNMR;
//                     break
//                 case "CNMR":
//                     modeObj = dataJSON.spectra_info.CNMR;
//                     break
//             }

//             let peaksArray = modeObj.peaks

//             textBox.innerText = modeObj.general_description;

//             for(let i = 0; i < peaksArray.length; i += 1)  {
                
//                 if (hoveredX == Math.round(peaksArray[i].x)) { /// Should be a range arround this number, instead of only exactly this number
//                     console.log("hoveredX: " + hoveredX)
//                     console.log("peaksArray[i].x: " + Math.round(peaksArray[i].x))
//                     console.log(hoveredX == Math.round(peaksArray[i].x))
//                     textBox.innerText = peaksArray[i].description;
//                 }
//             }
//         }
        
//     } catch (jsonError) {
//         console.error("Error fetching or parsing JSON in mousemove:", jsonError);
//         textBox.innerHTML = "Error loading description."; // Inform user of error
//     }
// }

// setupSpectrumInteractivity(canvases, "MS","Ethanol")