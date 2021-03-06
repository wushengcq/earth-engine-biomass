biomass = {}

biomass.boot = function(eeMapId, eeToken, callback) {
    google.load("visualization", "1.0");
    google.load("jquery", "1");
    //google.load("maps", "3");
    google.setOnLoadCallback(function(){
        var mapType = biomass.App.getEeMapType(eeMapId, eeToken);
        var app = new biomass.App(mapType);
        if (typeof callback === "function") {
            callback();
        }
    });
}

biomass.App = function(mapType) {
    this._map = this.createMap(mapType);
    this._drawingManager = this.createDrawingManager(this, this._map);
    this._overlays = [];
    this.initPanButton(this, $("#pan-button"), this._map, this._drawingManager);
    this.initPixelButton(this, $("#pixel-button"), this._map, this._drawingManager);
    this.initRegionButton(this, $("#region-button"), this._map, this._drawingManager);
    this.initCleanButton(this, $("#clean-button"), this._map, this._drawingManager);
    this.initVisibilityButton(this, $("#visibility-button"), this._map, this._drawingManager);
    this.initTestButton(this, $("#test-button"), this._map, this._drawingManager);
    this.initMapClicked(this, this._map);
}

biomass.App.EE_URL = "https://earthengine.googleapis.com";
biomass.App.DEFAULT_ZOOM = 11;
biomass.App.DEFAULT_CENTER = {lng: -94.31350708007812, lat: 48.16333749877855};
biomass.App.STATUS = {PAN:0, PICK_UP_PIXEL:1, PICK_UP_REGION:2};
biomass.App.prototype._current_status = biomass.App.STATUS.PAN;

biomass.App.getEeMapType = function(eeMapId, eeToken) {
    var eeMapOptions = {
        getTileUrl:function(tile, zoom) {
            var url = biomass.App.EE_URL + "/map/";
            url += [eeMapId, zoom, tile.x, tile.y].join("/");
            url += "?token=" + eeToken;
            return url;
        },
        tileSize: new google.maps.Size(256, 256)
    };
    return new google.maps.ImageMapType(eeMapOptions);
}

biomass.App.prototype.createMap = function(mapType) {
    var mapOptions = {
        backgroundColor: '#333333',
        center: biomass.App.DEFAULT_CENTER,
        disableDefaultUI: true,
        zoom: biomass.App.DEFAULT_ZOOM,
        fullscreenControl: false,
        mapTypeControl: true,
        //mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.RIGHT_TOP,
        }
    }
    var node = $('.bm-map').get(0);
    var map = new google.maps.Map(node, mapOptions);
    map.overlayMapTypes.push(mapType);
    return map;
}

biomass.App.prototype.createDrawingManager = function(self, map) {
    var drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: {
            fillColor:'#ffff00',strokeWeight:2,strokeColor:'#ffff00',
            fillOpacity: 0.2,
            editable: false, clickable: true,
            draggable: false
        }
    });

    google.maps.event.addListener(drawingManager, 'polygoncomplete', function(polygon) {
        self._overlays.push(polygon);
        var coords = self.getCoordinates(polygon.getPath()); 
        self.waiting(); 
        self.getRegionValue(self, coords)
    });

    drawingManager.setMap(map);
    return drawingManager;
}

biomass.App.prototype.getCoordinates = function(path) {
    var coords = ""
    var pathArray = path.getArray();
    for(var i = 0; i<pathArray.length; i++){
        var latLng = pathArray[i];
        if (i>0) coords += ","
        coords += latLng.lng() + "," + latLng.lat();
    }
    return coords;    
}

biomass.App.prototype.initMapClicked = function(self, map) {
    map.addListener('click', function(e) {
        if (self._current_status == biomass.App.STATUS.PICK_UP_PIXEL) {
            self.waiting(); 
            self.getPixelValue(self, e.latLng.lat(), e.latLng.lng());
        }
    });
}

biomass.App.prototype.initPixelButton = function(self, btn, map, mgr) {
    $(btn).click(function(e){
        self._current_status = biomass.App.STATUS.PICK_UP_PIXEL;
        map.setOptions({draggableCursor:'crosshair'});
        mgr.setDrawingMode(null);
    });
}

biomass.App.prototype.initRegionButton = function(self, btn, map, mgr) {
    $(btn).click(function(e){
        self._current_status = biomass.App.STATUS.PICK_UP_REGION;
        mgr.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    });
}

biomass.App.prototype.initPanButton = function(self, btn, map, mgr) {
    $(btn).click(function(e){
        self._current_status = biomass.App.STATUS.PAN;
        map.setOptions({draggableCursor:''});
        mgr.setDrawingMode(null);
    });
}

biomass.App.prototype.initCleanButton = function(self, btn, map, mgr) {
    $(btn).click(function(e){
        for(var i=0; i<self._overlays.length; i++) {
            self._overlays[i].setMap(null);
        }
        self._overlays = [];
        $('.bm-console').html("");
    });
}

biomass.App.prototype.initVisibilityButton = function(self, btn, map, mgr) {
    $(btn).click(function(e){
        if(self._map.overlayMapTypes.length > 0) {
            var layer = self._map.overlayMapTypes.getAt(0);
            if (layer.getOpacity() == 0) {
                layer.setOpacity(1);
            } else {
                layer.setOpacity(0);
            }
        }
    });
}

biomass.App.prototype.initTestButton = function(self, btn, map, mgr) {
    $(btn).click(function(e){
        console.log("testing");
        var overlay = self._map.overlayMapTypes.getAt(0);
        overlay.setOpacity(0.3);
    });
}

biomass.App.prototype.getPixelValue = function(self, lat, lng) {
    $.ajax({
        type: 'GET',
        async: true,
        url: '/pixelVal?',
        dataType: 'json',
        data: {'lat':lat, 'lng':lng},
        beforeSend: function(xhr){ xhr.setRequestHeader('Accept', 'application/json'); },
        success: function(data){ self.showPixelVal(data); },
        error: function(data){ alert(data); }
    });
}

biomass.App.prototype.getRegionValue = function(self, coords) {
    $.ajax({
        type: 'GET',
        async: true,
        url: '/regionVal?',
        dataType: 'json',
        data: {'coordinates':coords},
        beforeSend: function(xhr){ xhr.setRequestHeader('Accept', 'application/json'); },
        success: function(data){ self.showRegionVal(data); },
        error: function(data){ alert(data); }
    });
}

biomass.App.prototype.showPixelVal = function(vals) {
    var keys = ["biomass",  "longitude", "latitude"]
    this.showValues(keys, vals)
}

biomass.App.prototype.showRegionVal = function(vals) {
    var keys = ["count", "area", "min", "max", "sum", "mean", "stddev"];
    this.showValues(keys, vals)
}

biomass.App.prototype.showValues = function(keys, vals) {
    var content = "<center><table class='bm-table'>";
    for(var i=0; i<keys.length; i++){
        key = keys[i];
        content += "<tr><td>" + key + "</td><td>" + (vals[key] == null ? 'No Data' : this.fmtNum(vals[key]))+ "</td></tr>";
    }
    content += "</table></center>";
    $('.bm-console').html(content);    
}

biomass.App.prototype.waiting = function() {
    $(".bm-console").html("<center><div data-loader='circle'></div></center>")
}

biomass.App.prototype.fmtNum = function(coor) {
    return Math.round(coor * 10000) / 10000.0 
}

