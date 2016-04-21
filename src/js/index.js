(function() {

    var mnemonic = new Mnemonic("english");
    var seed = null
    var bip32RootKey = null;
    var bip32ExtendedKey = null;
    var network = bitcoin.networks.bitcoin;
    var addressRowTemplate = $("#address-row-template");

    var showIndex = true;
    var showAddress = true;
    var showPrivKey = true;

    var junkChangeTimeoutEvent = null;
    var phraseChangeTimeoutEvent = null;

    var DOM = {};
    DOM.network = $(".network");
    DOM.phraseNetwork = $("#network-phrase");
    DOM.junk = $(".junk");
    DOM.phrase = $(".phrase");
    DOM.passphrase = $(".passphrase");
    DOM.generate = $(".generate");
    DOM.seed = $(".seed");
    DOM.rootKey = $(".root-key");
    DOM.extendedPrivKey = $(".extended-priv-key");
    DOM.extendedPubKey = $(".extended-pub-key");
    DOM.bip32tab = $("#bip32-tab");
    DOM.bip44tab = $("#bip44-tab");
    DOM.bip32panel = $("#bip32");
    DOM.bip44panel = $("#bip44");
    DOM.bip32path = $("#bip32-path");
    DOM.bip44path = $("#bip44-path");
    DOM.bip44purpose = $("#bip44 .purpose");
    DOM.bip44coin = $("#bip44 .coin");
    DOM.bip44account = $("#bip44 .account");
    DOM.bip44change = $("#bip44 .change");
    DOM.strength = $(".strength");
    DOM.addresses = $(".addresses");
    DOM.rowsToAdd = $(".rows-to-add");
    DOM.more = $(".more");
    DOM.feedback = $(".feedback");
    DOM.tab = $(".derivation-type a");
    DOM.indexToggle = $(".index-toggle");
    DOM.addressToggle = $(".address-toggle");
    DOM.privateKeyToggle = $(".private-key-toggle");

    var derivationPath = $(".tab-pane.active .path").val();

    function init() {
        // Events
        DOM.network.on("change", networkChanged);
        DOM.junk.on("input", delayedJunkChanged);
        DOM.phrase.on("input", delayedPhraseChanged);
        DOM.passphrase.on("input", delayedPhraseChanged);
        DOM.generate.on("click", generateClicked);
        DOM.more.on("click", showMore);
        DOM.bip32path.on("input", bip32Changed);
        DOM.bip44purpose.on("input", bip44Changed);
        DOM.bip44coin.on("input", bip44Changed);
        DOM.bip44account.on("input", bip44Changed);
        DOM.bip44change.on("input", bip44Changed);
        DOM.tab.on("click", tabClicked);
        DOM.indexToggle.on("click", toggleIndexes);
        DOM.addressToggle.on("click", toggleAddresses);
        DOM.privateKeyToggle.on("click", togglePrivateKeys);
        disableForms();
        hidePending();
        hideValidationError();
        populateNetworkSelect();
    }

    // Event handlers

    function networkChanged(e) {
        var network = e.target.value;
        networks[network].onSelect();
        setBip44DerivationPath();
        delayedPhraseChanged();
    }

    function delayedJunkChanged() {
        hideValidationError();
        if (junkChangeTimeoutEvent != null) {
            clearTimeout(junkChangeTimeoutEvent);
        }
        junkChangeTimeoutEvent = setTimeout(junkChanged, 1000);
    }

    function junkChanged() {
        var junk = DOM.junk.val().toLowerCase();
        phrase = generatePhraseFromJunk(junk);
        phraseChanged();
    }

    function delayedPhraseChanged() {
        hideValidationError();
        showPending();
        if (phraseChangeTimeoutEvent != null) {
            clearTimeout(phraseChangeTimeoutEvent);
        }
        phraseChangeTimeoutEvent = setTimeout(phraseChanged, 400);
    }

    function phraseChanged() {
        showPending();
        hideValidationError();
        // Get the mnemonic phrase
        var phrase = DOM.phrase.val();
        var passphrase = DOM.passphrase.val();
        var errorText = findPhraseErrors(phrase);
        if (errorText) {
            showValidationError(errorText);
            return;
        }
        // Get the derivation path
        var errorText = findDerivationPathErrors();
        if (errorText) {
            showValidationError(errorText);
            return;
        }
        // Calculate and display
        calcBip32Seed(phrase, passphrase, derivationPath);
        displayBip32Info();
        hidePending();
    }

    function generateClicked() {
        clearDisplay();
        showPending();
        setTimeout(function() {
            var phrase = generateRandomPhrase();
            if (!phrase) {
                return;
            }
            phraseChanged();
        }, 50);
    }

    function tabClicked(e) {
        var activePath = $(e.target.getAttribute("href") + " .path");
        derivationPath = activePath.val();
        derivationChanged();
    }

    function derivationChanged() {
        delayedPhraseChanged();
    }

    function bip32Changed() {
        derivationPath = DOM.bip32path.val();
        derivationChanged();
    }

    function bip44Changed() {
        setBip44DerivationPath();
        derivationChanged();
    }

    function toggleIndexes() {
        showIndex = !showIndex;
        $("td.index span").toggleClass("invisible");
    }

    function toggleAddresses() {
        showAddress = !showAddress;
        $("td.address span").toggleClass("invisible");
    }

    function togglePrivateKeys() {
        showPrivKey = !showPrivKey;
        $("td.privkey span").toggleClass("invisible");
    }

    // Private methods

    function generatePhraseFromJunk(deck) {
        var numWords = parseInt(DOM.strength.val()),
            strength = numWords / 3 * 32,
            words = mnemonic.generate_from_junk(deck, strength);
        DOM.phrase.val(words);
        return words;
    }

    function generateRandomPhrase() {
        if (!hasStrongRandom()) {
            var errorText = "This browser does not support strong randomness";
            showValidationError(errorText);
            return;
        }
        var numWords = parseInt(DOM.strength.val());
        var strength = numWords / 3 * 32;
        var words = mnemonic.generate(strength);
        DOM.phrase.val(words);
        return words;
    }

    function calcBip32Seed(phrase, passphrase, path) {
        seed = mnemonic.toSeed(phrase, passphrase);
        bip32RootKey = bitcoin.HDNode.fromSeedHex(seed, network);
        bip32ExtendedKey = bip32RootKey;
        // Derive the key from the path
        var pathBits = path.split("/");
        for (var i=0; i<pathBits.length; i++) {
            var bit = pathBits[i];
            var index = parseInt(bit);
            if (isNaN(index)) {
                continue;
            }
            var hardened = bit[bit.length-1] == "'";
            if (hardened) {
                bip32ExtendedKey = bip32ExtendedKey.deriveHardened(index);
            }
            else {
                bip32ExtendedKey = bip32ExtendedKey.derive(index);
            }
        }
    }

    function showValidationError(errorText) {
        DOM.feedback
            .text(errorText)
            .show();
    }

    function hideValidationError() {
        DOM.feedback
            .text("")
            .hide();
    }

    function findPhraseErrors(phrase) {
        // TODO make this right
        // Preprocess the words
        phrase = mnemonic.normalizeString(phrase);
        var parts = phrase.split(" ");
        var proper = [];
        for (var i=0; i<parts.length; i++) {
            var part = parts[i];
            if (part.length > 0) {
                // TODO check that lowercasing is always valid to do
                proper.push(part.toLowerCase());
            }
        }
        // TODO some levenstein on the words
        var properPhrase = proper.join(' ');
        // Check the words are valid
        var isValid = mnemonic.check(properPhrase);
        if (!isValid) {
            return "Invalid mnemonic";
        }
        return false;
    }

    function findDerivationPathErrors(path) {
        // TODO
        return false;
    }

    function displayBip32Info() {
        // Display the key
        DOM.seed.val(seed);
        var rootKey = bip32RootKey.toBase58();
        DOM.rootKey.val(rootKey);
        var extendedPrivKey = bip32ExtendedKey.toBase58();
        DOM.extendedPrivKey.val(extendedPrivKey);
        var extendedPubKey = bip32ExtendedKey.toBase58(false);
        DOM.extendedPubKey.val(extendedPubKey);
        // Display the addresses and privkeys
        clearAddressesList();
        displayAddresses(0, 20);
    }

    function displayAddresses(start, total) {
        for (var i=0; i<total; i++) {
            var index = i + start;
            new TableRow(index);
        }
    }

    function TableRow(index) {

        function init() {
            calculateValues();
        }

        function calculateValues() {
            setTimeout(function() {
                var key = bip32ExtendedKey.derive(index);
                var address = key.getAddress().toString();
                var privkey = key.privKey.toWIF(network);
                addAddressToList(index, address, privkey);
            }, 50)
        }

        init();

    }

    function showMore() {
        var start = DOM.addresses.children().length;
        var rowsToAdd = parseInt(DOM.rowsToAdd.val());
        if (isNaN(rowsToAdd)) {
            rowsToAdd = 20;
            DOM.rowsToAdd.val("20");
        }
        if (rowsToAdd > 200) {
            var msg = "Generating " + rowsToAdd + " rows could take a while. ";
            msg += "Do you want to continue?";
            if (!confirm(msg)) {
                return;
            }
        }
        displayAddresses(start, rowsToAdd);
    }

    function clearDisplay() {
        clearAddressesList();
        clearKey();
        hideValidationError();
    }

    function clearAddressesList() {
        DOM.addresses.empty();
    }

    function clearKey() {
        DOM.rootKey.val("");
        DOM.extendedPrivKey.val("");
        DOM.extendedPubKey.val("");
    }

    function addAddressToList(index, address, privkey) {
        var row = $(addressRowTemplate.html());
        // Elements
        var indexCell = row.find(".index span");
        var addressCell = row.find(".address span");
        var privkeyCell = row.find(".privkey span");
        // Content
        var indexText = derivationPath + "/" + index;
        indexCell.text(indexText);
        addressCell.text(address);
        privkeyCell.text(privkey);
        // Visibility
        if (!showIndex) {
            indexCell.addClass("invisible");
        }
        if (!showAddress) {
            addressCell.addClass("invisible");
        }
        if (!showPrivKey) {
            privkeyCell.addClass("invisible");
        }
        DOM.addresses.append(row);
    }

    function hasStrongRandom() {
        return 'crypto' in window && window['crypto'] !== null;
    }

    function disableForms() {
        $("form").on("submit", function(e) {
            e.preventDefault();
        });
    }

    function setBip44DerivationPath() {
        var purpose = parseIntNoNaN(DOM.bip44purpose.val(), 44);
        var coin = parseIntNoNaN(DOM.bip44coin.val(), 0);
        var account = parseIntNoNaN(DOM.bip44account.val(), 0);
        var change = parseIntNoNaN(DOM.bip44change.val(), 0);
        var path = "m/";
        path += purpose + "'/";
        path += coin + "'/";
        path += account + "'/";
        path += change;
        DOM.bip44path.val(path);
        derivationPath = DOM.bip44path.val();
    }

    function parseIntNoNaN(val, defaultVal) {
        var v = parseInt(val);
        if (isNaN(v)) {
            return defaultVal;
        }
        return v;
    }

    function showPending() {
        DOM.feedback
            .text("Calculating...")
            .show();
    }

    function hidePending() {
        DOM.feedback
            .text("")
            .hide();
    }

    function populateNetworkSelect() {
        for (var i=0; i<networks.length; i++) {
            var network = networks[i];
            var option = $("<option>");
            option.attr("value", i);
            option.text(network.name);
            DOM.phraseNetwork.append(option);
        }
    }

    var networks = [
        {
            name: "Bitcoin",
            onSelect: function() {
                network = bitcoin.networks.bitcoin;
                DOM.bip44coin.val(0);
            },
        },
        {
            name: "Bitcoin Testnet",
            onSelect: function() {
                network = bitcoin.networks.testnet;
                DOM.bip44coin.val(1);
            },
        },
        {
            name: "Litecoin",
            onSelect: function() {
                network = bitcoin.networks.litecoin;
                DOM.bip44coin.val(2);
            },
        },
        {
            name: "Dogecoin",
            onSelect: function() {
                network = bitcoin.networks.dogecoin;
                DOM.bip44coin.val(3);
            },
        },
        {
            name: "ShadowCash",
            onSelect: function() {
                network = bitcoin.networks.shadow;
                DOM.bip44coin.val(35);
            },
        },
        {
            name: "ShadowCash Testnet",
            onSelect: function() {
                network = bitcoin.networks.shadowtn;
                DOM.bip44coin.val(1);
            },
        },
        {
            name: "Viacoin",
            onSelect: function() {
                network = bitcoin.networks.viacoin;
                DOM.bip44coin.val(14);
            },
        },
        {
            name: "Viacoin Testnet",
            onSelect: function() {
                network = bitcoin.networks.viacointestnet;
                DOM.bip44coin.val(1);
            },
        },
        {
            name: "Jumbucks",
            onSelect: function() {
                network = bitcoin.networks.jumbucks;
                DOM.bip44coin.val(26);
            },
        },
        {
            name: "CLAM",
            onSelect: function() {
                network = bitcoin.networks.clam;
                DOM.bip44coin.val(23);
            },
        },
    ]

    init();

})();
