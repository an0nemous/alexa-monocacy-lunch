var alexa = require('alexa-app'),
    replace = require('str-replace'),
    SchoolNames = require('SchoolNames');

console.log('creating alexa app...');

var app = new alexa.app();
var sessionAttributes = {};

app.launch(function (request, response) {
    response.session('open_session', 'true');
    response.say("Welcome to FCPS School menu.  You can ask for what's on the breakfast or lunch menu today, tomorrow or any date in the near future");
    response.shouldEndSession(false, "If you are not sure how to ask me, say help");
});

app.dictionary = {
    "schoolNames": SchoolNames.schools,
};

console.log("defining LunchIntent...");
// "{what is|what's} for {breakfast|lunch|MENUTYPE}{ on|} {-|MENUDATE} at {schoolNames|SCHOOL}{ school|}"

app.intent('MenuIntent',
    {
        "slots": {"MENUTYPE":"LITERAL", },
        "utterances": [
            "{what is|what's} for {breakfast|lunch|MENUTYPE}"
        ]
    },
    function (request, response) {
        getMenuWhen(request, response);
        return false;
    }
);

app.intent('MenuWhen',
    {
        "slots": {"MENUDATE":"AMAZON.DATE"}
    },
    function(request, response) {
        getMenuWhere(request, response);
        return false;
    }
);

// app.intent('MenuSchool',
//     {
//         "slots": {"SCHOOL":"LITERAL"}
//     },
//     function(request, response) {
//         getMenu(response, )
//         return false;
//     }
// );

console.log("defining HelpIntent...");

app.intent('HelpIntent',
    {
        "slots": {},
        "utterances": [
            "help"
        ]
    },
    function (request, response) {
        response.say("Here are some of the ways to get lunch or breakfast menu. You can say ");

        var rand = getRandomInt(1, 7);
        var schoolName = getRandomSchoolName();

        // TODO: each utterance should offer choice for each school
        switch (rand) {
            case 0:
                response.say("what is for lunch today at " + schoolName);
                break;
            case 1:
                response.say("what is for breakfast today at " + schoolName);
                break;
            case 2:
                response.say("what is for lunch today at " + schoolName + " school");
                break;
            case 3:
                response.say("what is for breakfast today at " + schoolName + " school");
                break;
            case 4:
                response.say("what's for lunch today at " + schoolName);
                break;
            case 5:
                response.say("what's for breakfast today at " + schoolName);
                break;
            case 6:
                response.say("what's for lunch today at " + schoolName + " school");
                break;
            case 7:
                response.say("what's for breakfast today at " + schoolName + " school");
                break;
        }

        response.send();
    }
);

/**
 * Getter for the school id
 *
 * @param schoolName
 *
 * @returns {*}
 */
function getSchoolCode(schoolName, response) {
    var SchoolCodes = require('SchoolCodes');

    if (typeof SchoolCodes.codes[schoolName] == 'undefined') {
        // TODO: what if someone tries to be clever
        // and specify a school we currently don't support?
        console.error('school not found: ' + schoolName);
        response.say ("sorry, I was not able to locate the school " + schoolName);

        if (response.session ('open_session') === 'true') {
            response.shouldEndSession(false);
        }

        response.send();
        return false;
    }

    return SchoolCodes.codes[schoolName];
}

/**
 * Getter for the menu type id (bfast|lunch)
 *
 * @param value
 *
 * @returns {*}
 */
function getMenuCode(menu) {
    var MenuCodes = require('MenuCodes');

    if (typeof MenuCodes.codes[menu] == 'undefined') {
        return false;
    }

    return MenuCodes.codes[menu];
}

/**
 * get the specified date
 *
 * @param value
 *
 * @returns {Array}
 */
function getDateArray(value) {
    menuDate = value.split('-');

    return menuDate;
}

/**
 * Returns formatted API URL
 *
 * @param schoolCode
 * @param menuCode
 * @param menuDate
 *
 * @returns {string}
 */
function getApiUrl(schoolCode, menuCode, menuDate) {
    // return 'http://frederick.nutrislice.com/menu/api/weeks/school/19619/menu-type/1621/2016/06/13/'
    var apiUrl = 'http://frederick.nutrislice.com/menu/api/weeks/school/';
    apiUrl += schoolCode + '/menu-type/' + menuCode + '/';
    apiUrl += menuDate[0] + '/' + menuDate[1] + '/' + menuDate[2] + '/';

    console.log("apiUrl: " + apiUrl);

    return apiUrl;
}

function getMenuWhen(request, response)
{
    response.session('type', request.slot('MENUTYPE'));

    // ask when
    response.say ('ok, ' + request.slot('MENUTYPE') + ' when');
}

function getMenuWhere(request, response)
{
    response.session('when', request.slot('MENUDATE'));
    // ask where
    getMenu(response, request.slot('SCHOOL'), request.slot('MENUTYPE'), request.slot('MENUDATE'));
}

//function getMen
/**
 * Gets the menu details
 *
 * @param response
 * @param schoolName
 * @param menuType
 * @param menuDate
 */
function getMenu(response, schoolName, menuType, menuDate) {
    var foodName,
        tmpFoodName,
        comboWord,
        menuJSON = {},
        _ = require('underscore');

    console.log("getting menu details..." + menuDate);

    if (!_.isDate(new Date(menuDate))) {
        response.say ("sorry, I do not understand the specified date " + menuDate);

        if (response.session ('open_session') === 'true') {
            response.shouldEndSession(false);
        }

        response.send();
        return;
    }

    // get the api url
    var apiUrl = getApiUrl(getSchoolCode(schoolName, response), getMenuCode(menuType), getDateArray(menuDate));

    var needle = require('needle');
    needle.get(apiUrl, {}, function (err, res) {
        console.log("am getting the menu, pls wait...");
        if (err || res.statusCode !== 200) {
            response.say ("sorry, I was not able to find a " + menuType + " menu for " + schoolName + " for " + menuDate);

            if (response.session ('open_session') === 'true') {
                response.shouldEndSession(false);
            }

            response.send();
            return;
        }

        menuJSON = res.body;

        // we can't find a menu
        if (_.isEmpty(menuJSON)) {
            console.error('no menu available');
            response.say ("sorry, I was not able to find a " + menuType + " menu for " + schoolName + " for " + menuDate);

            if (response.session ('open_session') === 'true') {
                response.shouldEndSession(false);
            }
            response.send();
            return;
        }

        var responseText = "For " + menuType + " at " + schoolName + " school on " + menuDate
        var cardTitle = schoolName + " (" + menuDate + ")";
        var cardText;

        _.map(menuJSON.days, function (content) {
            _.map(content.menu_items, function (data) {

                if (!data.hasOwnProperty('date') || _.isNull(data.date)) {
                    return false;
                }

                if (data.date != menuDate || _.isNull(data.menu_type_id)) {
                    return false;
                }

                /**
                 * get food
                 *  if combo word, append combo word to food
                 *      unset combo word
                 *      complete
                 *  else
                 *      complete
                 */

                if (data.is_section_title) {
                    // todo: check if there's an existence of food, otherwise we lose it

                    if (!_.isUndefined(foodName)) {
                        responseText += ", " + foodName;
                    }

                    foodName = undefined;

                    //console.log(data.text + ', choices are:');
                    return;
                }

                // get the preposition / conjunction: with a, or - if any
                if (!data.is_section_title && data.text != "") {
                    /**
                     * todo: simply append the combo word here and set a tmpFoodName to know
                     * it's a combo word and we still need to get the complete food name in the
                     * next iteration
                     */
                    comboWord = data.text;
                    tmpFoodName = foodName + ' ' + comboWord.trim();
                    comboWord = undefined;
                }

                if (_.has(data, 'food') && _.isObject(data.food)) {
                    /**
                     * check for tmpFoodName, append this food to it
                     * unset tmpFoodName
                     */
                    if (!_.isUndefined(tmpFoodName)) {
                        responseText += ", " + tmpFoodName + ' ' + data.food.name;

                        console.log();

                        foodName = undefined;
                        tmpFoodName = undefined;
                    } else {
                        /**
                         * if previous food exists, preserve it
                         * get the current food
                         */
                        if (!_.isUndefined(foodName)) { // if previous food exists
                            // food name from previous action, but no combo we don't want to overwrite it
                            //console.log("food name from previous action: " + foodName);
                            responseText += ", " + foodName;
                        }

                        foodName = data.food.name;
                    }
                }

            });
        });

        cardText = responseText;
        console.log('cardText: ' + cardText);

        responseText = replace.all("&").from(responseText).with("and");
        console.log ("responseText: " + responseText);

        response.say (responseText);
        response.card (cardTitle, cardText);

        if (response.session ('open_session') === 'true') {
            response.shouldEndSession (false);
        }

        response.send ();

    });
}

/**
 * Returns a random number
 *
 * @param min
 * @param max
 *
 * @returns {int}
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random school name
 *
 * @returns {string}
 */
function getRandomSchoolName() {
    var numSchools = SchoolNames.schools.length;
    var idx = getRandomInt(0, numSchools - 1);

    return SchoolNames.schools[idx];
}

exports.handler = app.lambda();

if ((process.argv.length === 3) && (process.argv[2] === 'schema')) {
    console.log (app.schema ());
    console.log (app.utterances ());
}
