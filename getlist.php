<?php
$list = $_GET['list'];

if($list == 'LNM'){
    $target_url = "https://www.navcen.uscg.gov/sites/default/files/xml/lnms/LNM.xml";
}
else if(!preg_match("/^[A-Za-z0-9]{5}$/", $list)){
    echo "invalid input";
    exit();
}
else{
    $target_url = "https://www.navcen.uscg.gov/sites/default/files/xml/lightLists/weeklyUpdates/" . $list . "WeeklyChanges.xml";
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
if($response == false){
    echo 'Error: ' . curl_error($ch);
}
curl_close($ch);
header('Content-Type: text/xml');
echo $response;
?>