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

async function mergeSmiles(smile1, smile2) {
    const response = await fetch("https://smilesmerger.onrender.com/combine_smile", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        smile1: smile1,
        smile2: smile2
    })
    });
    const data = await response.json(); 
    return data.combined_smile;         
}

async function mergeImages(selected1, selected2, canvasSelector="#frag-canvas") {
    let RDKit = await loadRDKit()
    const svgString1 = decodeURIComponent(selected1.dataset.smiles);
    const svgString2Unprocessed = decodeURIComponent(selected2.dataset.smiles);
    let canvas = document.querySelector(canvasSelector)

    let svgString2 = await removeOneBond(svgString2Unprocessed);
    let mergedString = await mergeSmiles(svgString1, svgString2);

    console.log(mergedString)

    selected1.remove();
    selected2.remove();

    /// need a cache for undo and if new smile string is = to cached smile string =>  do nothing
    const mergedMol = RDKit.get_mol(mergedString);
    const mergedSvg = mergedMol.get_svg().replace(
    "<svg",
    `<svg id="merged-svg" style="width: 30%" data-smiles="${mergedString}"`
    );
    // makeDeletable(clonedFrag)
    canvas.innerHTML += mergedSvg;

}

async function removeOneBond(SMILEStr, position) {
    let RDKit = await loadRDKit()
    console.log("secondary string: " + SMILEStr)
          /// convert SMILEstr into molblock
          let mol = RDKit.get_mol(SMILEStr);
          let molblock = mol.get_molblock()
          let emptyBonds = getEmptyBondIndex(molblock)
          console.log("selected2 emptyBonds: " + emptyBonds)

          let emptyBondIndex = emptyBonds[Math.floor(Math.random() * emptyBonds.length)]
          console.log("selected2 emptyBondIndex: " + emptyBondIndex)

          let spliceIndex = molblockIndexToSmilePos(emptyBondIndex, SMILEStr)
          console.log("selected2 spliceIndex: " + spliceIndex)

          console.log("Secondary molblock: " + molblock)
          console.log("Secondary mol empty bond: " + emptyBonds)
          /// get emptyIndex
          let newSmiles;
          
          const firstTwo = SMILEStr.slice(0, 2);
          const firstThree = SMILEStr.slice(0, 3);
          const firstFour = SMILEStr.slice(0, 4);

          if (
            SMILEStr.length <= 5 && (
              firstTwo === "BrC" ||
              firstTwo === "ClC" ||
              firstFour === "[H]C" ||
              firstFour === "N(C)" ||
              firstTwo === "OC"
            )
          ) {
            if (firstFour === "N(C)") {
                newSmiles = SMILEStr.slice(0, -3); 
                console.log("case 1.1");
                return newSmiles;
            }
            else {
                newSmiles = SMILEStr.slice(0, -1);
                console.log("case 1.2");
                return newSmiles;
            }
          }
           else if (SMILEStr[0].toUpperCase() === "C" && SMILEStr[1].toUpperCase() === "C" || SMILEStr === "CN(C)C" || SMILEStr === "COC") {
              console.log("case 3")
              newSmiles = SMILEStr.slice(1);
              return newSmiles;
            }
            /// else (not empty first bond):
            else {
              /// move first to an empty bond using emptyIndex by count to the emptyIndex C
              console.log("case 4")
              let element;
              let adjustment;

              if (SMILEStr[0].toUpperCase() !== "C") {
                  element = SMILEStr.slice(0,2);
                  SMILEStr = SMILEStr.slice(2); 
                  adjustment = 2;
              } else {
                  if (SMILEStr[1] === "l") {
                    console.log("subcase 1")
                    element = SMILEStr.slice(0, 2);
                    SMILEStr = SMILEStr.slice(2); 

                    adjustment = 2;
                  } else {
                        console.log("subcase 2")
                        element = SMILEStr.slice(0, 1);
                        SMILEStr = SMILEStr.slice(1);
                        adjustment = 1;
                  }
              }
              
              SMILEStr = SMILEStr.slice(0, spliceIndex-adjustment) + element + SMILEStr.slice(spliceIndex-(adjustment-1)); /// Problem: C(Cl)C(C)CCl
              console.log(element)
              console.log("Processed SMILE str: " + SMILEStr);
              return SMILEStr;
            }
}

function getFirstCommonElement(arrA, arrB) {
          const setB = new Set(arrB); 
          console.log("setA: " + arrA)
          console.log("setB: " + arrB)
          for (const elem of arrA) {
              if (setB.has(elem)) {
                  return elem; 
              }
          }
          return null; 
        }

        function molblockIndexToSmilePos(molblockIndex, smile) {
          let atomCount = 1;   
          let smilePos = 0; 
          const twoLetterAtoms = ["Cl", "Br"]; // Add any others you want here

          console.log("smile: " + smile);

          for (let i = 0; i < smile.length; i++) {
              const char = smile[i];
              const nextChar = smile[i + 1];

              // Check for two-letter atom (e.g., Cl, Br)
              if (
                  nextChar && 
                  twoLetterAtoms.includes(char + nextChar)
              ) {
                  // Found two-letter atom like "Cl"
                  if (atomCount === molblockIndex) {
                      console.log("Found at atom count:", atomCount, "Two-letter atom:", char + nextChar, "SmilePos:", smilePos);
                      return smilePos;
                  }
                  atomCount += 1;
                  smilePos += 2; // skip both letters
                  i+=1;           // skip nextChar in loop
                  continue;
              }

              // Check for single-letter atom
              if (/[A-Za-z]/.test(char)) {
                  if (atomCount === molblockIndex) {
                      console.log("Found at atom count:", atomCount, "Char:", char, "SmilePos:", smilePos);
                      return smilePos;
                  }
                  atomCount += 1;
              }

              smilePos += 1;
          }

          console.warn("molblockIndex not found in SMILES");
          return null;
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

async function setUpCanvas(path='', molCanvasId, specCanvasId, molWidthPercent, molHeightPercent, specWidthPercent, specHeightPercent) {
    removeCanvas(molCanvasId)
    removeCanvas(specCanvasId)

    let data = await getData(path) 

    let canvas = new ChemDoodle.io.JCAMPInterpreter().makeStructureSpectrumSet(
        'sample', 
        data, 
        percentage("#" + molCanvasId, molWidthPercent, "width"), 
        percentage("#" + molCanvasId, molHeightPercent, "height"), 
        percentage("#" + specCanvasId, specWidthPercent, "width"), 
        percentage("#" + specCanvasId, specHeightPercent, "height"),
    )

    console.log(canvas);
    return canvas;
}

let resizeTimeout;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(async () => {
        canvases = await setUpCanvas(
            'data/spectra/' + viewingMode + '/' + displayingMol + viewingMode + '.jdx',
            MOL_CANVAS_ID,
            SPEC_CANVAS_ID,
            MOL_CANVAS_WIDTH,
            MOL_CANVAS_HEIGHT,
            SPEC_CANVAS_WIDTH,
            SPEC_CANVAS_HEIGHT
        );
    }, 30);
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