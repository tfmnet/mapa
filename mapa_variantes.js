const page = document.body;
const width = window.innerWidth;
const height = window.innerHeight;
const selectedColors = new Set();
let flagData = {};
let alpha2ByAlpha3 = {};
let selectedCountryPath = null;

const svg = d3.select("#map")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("width", width)
  .attr("height", height);

function parseObject(source, declaration) {
  const start = source.indexOf(declaration);
  const objectStart = source.indexOf("{", start);
  let depth = 0;
  let inString = false;
  let quote = "";
  for (let index = objectStart; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (character === quote && source[index - 1] !== "\\") inString = false;
      continue;
    }
    if (character === "\"" || character === "'") {
      inString = true;
      quote = character;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return new Function(`return ${source.slice(objectStart, index + 1)}`)();
    }
  }
  throw new Error(`Não foi possível ler ${declaration}`);
}

function parseAlpha2Map(source) {
  const match = source.match(/const alpha2ByAlpha3 = (.*?);\n\nfunction showCountryInfo/s);
  return match ? new Function(`return ${match[1]}`)() : {};
}

async function loadData() {
  const source = await fetch("mapa.html").then(response => response.text());
  flagData = parseObject(source, "const flagData");
  alpha2ByAlpha3 = parseAlpha2Map(source);
  const world = await d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson");
  drawMap(world);
}

function countryMatches(countryColors) {
  return [...selectedColors].every(color => countryColors.includes(color));
}

function updateCount() {
  const matching = Object.values(flagData).filter(countryMatches).length;
  const count = document.getElementById("country-count");
  count.textContent = selectedColors.size === 0
    ? `${Object.keys(flagData).length} países considerados`
    : matching === 0
      ? "Noooooope!.... nobody is that tacky!!..."
      : `${matching} ${matching === 1 ? "país selecionado" : "países selecionados"}`;
}

function updateMap() {
  updateCount();
  d3.selectAll(".country").attr("fill", country => {
    if (selectedColors.size === 0) return "var(--country-default)";
    return countryMatches(flagData[country.id] || [])
      ? "var(--country-match)"
      : "var(--country-muted)";
  });
}

function clearCountryInfo() {
  const info = document.getElementById("country-info");
  info.classList.remove("visible");
  info.removeAttribute("style");
  document.getElementById("country-flag").removeAttribute("src");
  document.getElementById("country-name").textContent = "";
  if (selectedCountryPath) selectedCountryPath.classListed = false;
  selectedCountryPath = null;
}

function showCountryInfo(event, country) {
  event.stopPropagation();
  const info = document.getElementById("country-info");
  const flag = document.getElementById("country-flag");
  const name = document.getElementById("country-name");
  const [x, y] = d3.pointer(event, svg.node());
  const infoWidth = 190;
  const infoHeight = 92;
  const left = Math.max(12, Math.min(width - infoWidth - 12, x + 16));
  const top = Math.max(12, Math.min(height - infoHeight - 12, y - infoHeight - 12));
  info.style.left = `${left}px`;
  info.style.top = `${top}px`;
  name.textContent = country.properties.name;
  flag.alt = `Bandeira de ${country.properties.name}`;
  flag.src = `https://flagcdn.com/w160/${alpha2ByAlpha3[country.id]}.png`;
  info.classList.add("visible");
}

function drawMap(world) {
  const projection = d3.geoNaturalEarth1().fitSize([width, height], world);
  const path = d3.geoPath().projection(projection);
  svg.append("g")
    .selectAll("path")
    .data(world.features)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", "var(--country-default)")
    .on("click", showCountryInfo)
    .append("title")
    .text(country => country.properties.name);
  updateMap();
}

document.querySelectorAll(".color-btn").forEach(button => {
  button.addEventListener("click", event => {
    event.stopPropagation();
    const color = button.dataset.color;
    if (selectedColors.has(color)) {
      selectedColors.delete(color);
      button.classList.remove("active");
    } else {
      selectedColors.add(color);
      button.classList.add("active");
    }
    updateMap();
  });
});

document.addEventListener("click", clearCountryInfo);
svg.on("click", clearCountryInfo);
updateCount();
loadData().catch(error => {
  document.getElementById("country-count").textContent = "Não foi possível carregar o mapa.";
  console.error(error);
});
