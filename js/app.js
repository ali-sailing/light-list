let CURRENT_DISTRICT = 0;
let CURRENT_DIST_VOL = "";
let CACHE_DOC = undefined;
let CACHE_LNM = undefined;

function el(s) {
  return document.getElementById(s);
}

function el_change(event){
  
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function dm_to_dd(d, m) {
  var mult = d < 0 ? -1.0 : 1.0;
  var res = parseFloat(Math.abs(d)) + parseFloat(Math.abs(m)) / 60.0;
  return mult * res;
}

function dms_to_dd(str) {
  let direction = str.slice(-1);
  let parts = str.slice(0, -1).split(/\-/);
  let dd = Number(parts[0]) + Number(parts[1])/60 + Number(parts[2])/(60*60);
  if (direction == "S" || direction == "W") {
    dd = dd * -1;
  }
  return dd;
}

function dd_to_dm(dd, is_lat){
  let sign = "";
  let padlen = 2;
  if(is_lat){
    sign = dd < 0 ? "S" : "N";
  }
  else{
    padlen = 3;
    sign = dd < 0 ? "W" : "E";
  }
  dd = Math.abs(dd);
  let dm = Math.floor(dd);
  
  let min = 60. * (dd - Math.floor(dd));
  let mindec = Math.round(100 * (min - Math.floor(min)));

  return pad(dm,padlen) + "&deg;&nbsp;" + pad(Math.floor(min),2) + "." + pad(mindec,2) + "&apos;" + sign;
}

async function get_xml(url) {
  let response = await fetch(url);
  if (response.ok) {
    let xmlStr = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "application/xml");
    return doc;
  } else {
    alert("Could not get data: " + response.status);
  }
}

function get_node(p, name){
  const el = p.getElementsByTagName(name);
  if(el.length > 0){
    return el[0];
  }
  return undefined;
}

function get_node_text(p, name){
  const el = p.getElementsByTagName(name);
  if(el.length > 0){
    return el[0].textContent;
  }
  return undefined;
}

function parse_lights(doc){
  const lights = [];
  for(let light_node of doc.getElementsByTagName("LLNR")){
    let p = light_node.parentElement;
    let light = {}
    light.district = get_node_text(p,"District");
    light.llnr = get_node_text(p,"LLNR");
    light.xref = get_node_text(p,"XREF");
    light.name = get_node_text(p,"Aid_x0020_Name");
    light.characteristic = get_node_text(p,"Characteristic");

    light.night_and_day = get_node_text(p,"Both_x002F_Night_x002F_Day");
    light.is_private = (get_node_text(p,"Aid_x0020_Type") == "PA");
    light.height = get_node_text(p,"Height");
    light.range = get_node_text(p,"Range");
    light.location = get_node_text(p,"Location");
    light.structure = get_node_text(p,"Structure");
    light.remarks = get_node_text(p,"Remarks");
    light.remarks = light.remarks.replace(/(?:\r\n|\r|\n)/g, '<br>');
    light.racon = get_node_text(p,"RACN_x0020_Morse_x0020_Char");

    light.lat = dms_to_dd(get_node_text(p,"Position_x0020__x0028_Latitude_x0029_"));
    light.lon = dms_to_dd(get_node_text(p,"Position_x0020__x0028_Longitude_x0029_"));

    lights.push(light);
  }

  return lights;
}

function updateStatus(msg) {
  el("statusText").innerHTML = msg;
}

function light_compare( a, b ) {
  let l = pad(a.llnr, 6);
  if(a.night_and_day){
    l += a.night_and_day;
  }
  let r = pad(b.llnr, 6);
  if(b.night_and_day){
    r += b.night_and_day;
  }
  if ( l < r ){
    return -1;
  }
  if ( l > r ){
    return 1;
  }
  return 0;
}


async function generate_light_list(){
  const lat0 = dm_to_dd(el('input0LatDeg').value, el('input0LatMin').value);
  const lon0 = dm_to_dd(el('input0LonDeg').value, el('input0LonMin').value);

  const lat1 = dm_to_dd(el('input1LatDeg').value, el('input1LatMin').value);
  const lon1 = dm_to_dd(el('input1LonDeg').value, el('input1LonMin').value);  

  const dist_vol = el("inputDistrict").value;
  const new_dist = Number(dist_vol.split("d")[1]);

  if(dist_vol != CURRENT_DIST_VOL){
    // invalidate caches
    CACHE_DOC = undefined;
    CACHE_LNM = undefined;
  }
  CURRENT_DIST_VOL = dist_vol;
  CURRENT_DISTRICT = new_dist;

  // Clear output
  el("listName").innerHTML = el("inputName").value;
  el("bounds").innerHTML = "";
  el("lightListBody").innerHTML = "";


  let url = "./getlist.php?list=" + dist_vol;
  let lnmUrl = "./getlist.php?list=LNM";
  if (document.location.hostname === "localhost"){
    url = "./data/" + dist_vol + "WeeklyChanges.xml";
    lnmUrl = "./data/LNM.xml";
  }

  let doc = CACHE_DOC;
  if(doc == undefined){
    updateStatus("Downloading light list... Please wait");
    doc = await get_xml(url);
    CACHE_DOC = doc;
  }
  
  let lnmDoc = CACHE_LNM;
  if(lnmDoc == undefined){
    updateStatus("Downloading Daily LNM Open Discrepancies and Temporary Changes... Please wait");
    lnmDoc = await get_xml(lnmUrl);
    CACHE_LNM = lnmDoc;
    updateStatus("Download complete");
  }

  let lights = parse_lights(doc);
  let generated_date = doc.getElementsByTagName("dataroot")[0].getAttribute("generated");

  const matches = [];
  const llnr_map = new Map();
  for(let light of lights){
    if(light.lat >= lat0 && light.lat <= lat1){
      if(light.lon >= lon0 && light.lon <= lon1){
        matches.push(light);
        llnr_map.set(light.llnr, true);
      }
    }
  }

  matches.sort(light_compare);

  // Remove dups
  const light_list = [];
  if(matches.length > 0){
    light_list.push(matches[0]);
  }
  for(i = 1; i < matches.length; i++){
    let prev = matches[i - 1];
    if(matches[i].llnr == prev.llnr){
      // We found a dup, update day/night
      prev.characteristic += "<br/>(" + prev.night_and_day + ")";
      prev.characteristic += "<br/>" + matches[i].characteristic + "<br/>(" + matches[i].night_and_day + ")";
    }
    else{
      light_list.push(matches[i]);
    }
  }

  const lnm_info = add_lnm_info(llnr_map, lnmDoc);

  let last_lnm = get_node_text(lnmDoc, "WEEK");

  el("bounds").innerHTML = "Southwest point: " + dd_to_dm(lat0, true) + " " + dd_to_dm(lon0, false) + " to Northeast " + dd_to_dm(lat1, true) + " " + dd_to_dm(lon1, false);
  let dt = luxon.DateTime.fromISO(generated_date);
  updateStatus(light_list.length + " matching lights found, data from <a href='https://www.navcen.uscg.gov/weekly-light-lists'>USCG Weekly Light List</a> generated " + dt.toFormat("MMM d, yyyy HH:mm ZZZZ") + 
  "<br/>Including updates from <a href='https://www.navcen.uscg.gov/daily-lnm-open-discrepancies-temporary-changes-file'>Daily LNM Open Discrepancies and Temporary Changes File</a> up to week " + last_lnm);

  create_light_table(light_list, lnm_info);

}

function add_lnm_info(llnr_map, lnmDoc){
  let lnm_info = new Map();
  for(let aid of lnmDoc.getElementsByTagName("AID")){
    let district = get_node_text(aid,"USCG_DISTRICT");
    let llnr = get_node_text(aid,"LIGHT_LIST_NUMBER");
    if(district == CURRENT_DISTRICT && llnr_map.has(llnr)){
      let p = aid.parentElement;
      let status = get_node(p,"STATUS") ;
      if(status){
        let summary = get_node_text(status, "SUMMARY");
        let lnm_start = get_node_text(p,"LNM_START_DATE");
        let lnm_type = "Discrepancy";
        if(p.nodeName == "TEMPORARY_CHANGE"){
          lnm_type = "Temporary Change";
        }
        let msg = lnm_type + ": " + summary + " since LNM " + lnm_start;
        if(lnm_info.has(llnr)){
          msg = lnm_info.get(llnr) + "<br/>" + msg;
        }
        lnm_info.set(llnr,msg);
      }
    }
  }
  return lnm_info;
}

function create_light_table(lights, lnm_info){
  const tb = el("lightListBody");
  tb.innerHTML = "";
  for(let light of lights){
    let row = document.createElement("tr");
    row.appendChild(make_cell(light.llnr));
    row.appendChild(make_cell(light.name + "<br/>" + light.location));
    row.appendChild(make_cell(dd_to_dm(light.lat, true) + "<br/>" + dd_to_dm(light.lon, false)));
    row.appendChild(make_cell(light.characteristic));
    row.appendChild(make_cell(light.height));
    row.appendChild(make_cell(light.range));
    row.appendChild(make_cell(light.structure));

    let remarks = light.remarks;
    if(light.is_private){
      if(remarks && remarks.length > 0){
        remarks += "<br/>";
      }
      remarks += "Private aid.";
    }
    if(lnm_info.has(light.llnr)){
      if(remarks && remarks.length > 0){
        remarks += "<br/>";
      }
      remarks = "<strong>" + lnm_info.get(light.llnr) + "</strong>";
    }
    row.appendChild(make_cell(remarks));
    tb.appendChild(row);
  }
}

function make_cell(str){
  let cell = document.createElement("td");
  cell.innerHTML = str;
  return cell;
}


(function() {
  'use strict';
  window.addEventListener('load', function() {
    // fetch all the forms we want to apply custom style
    var inputs = document.getElementsByClassName('form-control')

    // loop over each input and watch blur event
    var validation = Array.prototype.filter.call(inputs, function(input) {

      input.addEventListener('input', function(event) {
        // reset
        input.classList.remove('is-invalid')
        input.classList.remove('is-valid')

        if (input.checkValidity() === false) {
            input.classList.add('is-invalid')
        }
        else {
            //input.classList.add('is-valid')
        }
      }, false);
    });
  }, false);
})()
