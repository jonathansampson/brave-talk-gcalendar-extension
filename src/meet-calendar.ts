import { generateRoomWithoutSeparator } from "./RoomnameGenerator";
import $ from "jquery";

const BASE_DOMAIN = "talk.brave.com";
const BASE_URL = "https://" + BASE_DOMAIN + "/";
const APP_NAME = "Brave Talk";

//A text to be used when adding info to the location field.
const LOCATION_TEXT = APP_NAME + ' Meeting';

function escapeHtml(unsafe: string) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * The event page we will be updating.
 */
abstract class EventContainer {
        // used to implement autocreate meetings, this is done after all
        // the needed information is retrieved as numbers, upon calling update
        public scheduleAutoCreateMeeting: boolean = false;

    // Numbers used to access the service, will be listed in the
    // autogenerated description of the event when adding a meeting to it.
    // {"US": ["+1xxx", "+1xxx"], "France": ["+33xxx"]}
    private numbers: Record<string, string[]> = {};

    private containerElement: HTMLElement | undefined;
    protected descriptionInstance: DescriptionWrapper | undefined;
    protected locationInstance: LocationWrapper | undefined;
    private meetingId: string | undefined;
    /**
     * @returns {EventContainer}
     */
    static getInstance(): EventContainer | undefined {
        const body = document.querySelector('body');
     if (body && body.dataset.viewfamily)
            return new G2Event(body);
    }

    /**
     * The description of the event.
     * @abstract
     * @returns {Description}
     */
    abstract get description(): DescriptionWrapper;

    /**
     * The button container where we will add the jitsi button.
     * @abstract
     */
    abstract get buttonContainer(): JQuery<HTMLElement> | null;

    /**
     * The location of the event.
     * @abstract
     * @returns {Location}
     */
    abstract get location(): LocationWrapper; 

    /**
     * The container element of the event edit page.
     * @returns {*}
     */
    get container(): HTMLElement | undefined {
        return this.containerElement;
    };

    set container(c: HTMLElement | undefined){
        this.containerElement = c;
    };

    /**
     * Main entry point of the event modifictaions.
     * @abstract
     */
    abstract update(): void;

    /**
     * Checks for the button on current page
     */
    isButtonPresent() {
        return ($('#jitsi_button').length >= 1);
    }

    /**
     * Clears instances.
     */
    reset() {
        this.descriptionInstance = undefined;
        this.locationInstance = undefined;
    }

    /**
     * Updates meetingId, if there is meetingId set it, if not generate it.
     */
    updateMeetingId() {

        if (!this.isButtonPresent()) {
            // there is no button present we will add it, so we will clean
            // the state of the EventContainer, so we can update all values.
            // this clears the states between creating/editing different events
            // we add the button
            this.reset();
        }

        var inviteText;
        var ix = -1;

        // checking location
        if (this.location && this.location.text) {
            inviteText = this.location.text;

            if (inviteText)
                ix = inviteText.indexOf(BASE_URL);
        }

        // if nothing found let's check description
        if (ix == -1) {
            inviteText = this.description.value;

            if (inviteText)
                ix = inviteText.indexOf(BASE_URL);
        }

        var url;
        if (ix != -1 && (url = inviteText?.substring(ix)) && url.length > 0) {
            let resMeetingId = url.substring(BASE_URL.length);

            // there can be ',' after the meeting, normally added when adding
            // physical rooms to the meeting
            var regexp = /([a-zA-Z]+).*/g;
            var match = regexp.exec(resMeetingId);
            if (match && match.length > 1)
                resMeetingId = match[1];

            this.meetingId = resMeetingId;
        }
        else {

            this.meetingId = generateRoomWithoutSeparator();

            if (this.scheduleAutoCreateMeeting) {
                this.description.clickAddMeeting(
                    false, this.location);
                this.scheduleAutoCreateMeeting = false;
            }
        }
    }

    /**
     * Adds the jitsi button in buttonContainer.
     */
    addJitsiButton() {
        var container = this.buttonContainer;
        if (!container)
            return;

        var description = this.description;

        container.addClass('button_container');
        container.append(
            '<div id="jitsi_button" ' +
                'class="goog-inline-block jfk-button jfk-button-action ' +
                    'jfk-button-clear-outline">' +
                '<a href="#" style="color: white"></a>' +
            '</div>');
        description.update(this.location);
    }
}

/**
 * Represents the location field.
 */
abstract class LocationWrapper {
    /**
     * The text in the location field.
     * @abstract
     */
    abstract get text(): string | undefined;

    /**
     * Adds location info.
     * @abstract
     * @param text
     */
    abstract addLocationText(text: string): void;
}

/**
 * Represents the description of the event.
 */
abstract class DescriptionWrapper {
    protected event: any;

    constructor(event: any) {
        this.event = event;
    }
    /**
     * Updates the description and location field is not already updated.
     * @param location
     */
    update(location: any) {
        var isDescriptionUpdated = false;

        // checks whether description was updated.
        if (this.element != undefined) {
            var descriptionContainsURL =
                (this.value
                    && this.value.length >= 1
                    && this.value.indexOf(BASE_URL) !== -1);
            isDescriptionUpdated =
                descriptionContainsURL
                // checks whether there is the generated name in the location
                // input if there is a location
                || (location != null
                    && location.text
                    && location.text.indexOf(LOCATION_TEXT) != -1);
        }

        if(isDescriptionUpdated) {
            // update button url of event has all the data
            this.updateButtonURL();
        } else {
            // update button as event description has no meeting set
            this.updateInitialButtonURL(location);
        }
    }

    /**
     * Creates meeting, filling all needed fields.
     * @param isDescriptionUpdated - whether description was already updated,
     * true when we are editing event.
     * @param the location to use to fill the meeting URL
     */
    clickAddMeeting(isDescriptionUpdated: boolean, location: LocationWrapper) {
        if (!isDescriptionUpdated) {
            // Build the invitation content
            this.addDescriptionText(this.getInviteText());
            this.updateButtonURL();

            if (location)
                location.addLocationText(
                    LOCATION_TEXT + ' - ' + BASE_URL + this.event.meetingId);
        } else {
            this.updateButtonURL();
        }
    }

    /**
     * The description html element.
     * @abstract
     */
    abstract get element(): JQuery<HTMLElement>;
    /**
     * The text value of the description of the event.
     * @abstract
     */
    abstract get value(): string;

    /**
     * Adds description text to the existing text.
     * @abstract
     * @param text
     */
    abstract addDescriptionText(text: string): void;

    /**
     * Generates description text used for the invite.
     * @param dialInID optional dial in id
     * @returns {String}
     */
    getInviteText(dialInID?: string): string {
        let inviteText: string;
        let hasTemplate = false;

        if (this.event.inviteTextTemplate) {
            inviteText = this.event.inviteTextTemplate;
            hasTemplate = true;
        } else {
            inviteText =
                "Click the following link to join the meeting " +
                "from your computer: " + BASE_URL + this.event.meetingId;
        }

        if (this.event.numbers && Object.keys(this.event.numbers).length > 0) {
            if (this.event.inviteNumbersTextTemplate) {
                inviteText += this.event.inviteNumbersTextTemplate;
                hasTemplate = true;
                Object.keys(this.event.numbers).forEach(key => {
                    let value = this.event.numbers[key];
                    inviteText = inviteText.replace(
                        '{' + key + '}',
                        key + ": " + value);
                });
            } else {
                inviteText += "\n\n=====";
                inviteText +="\n\nJust want to dial in on your phone? ";
                inviteText += " \n\nCall one of the following numbers: ";
                Object.keys(this.event.numbers).forEach(key => {
                    let value = this.event.numbers[key];
                    inviteText += "\n" + key + ": " + value;
                });
                inviteText += "\n\nSay your conference name: '"
                    + this.event.meetingId
                    + "' and you will be connected!";
            }
        }

        if (hasTemplate) {
            inviteText = inviteText.replace(/\{BASE_URL\}/g, BASE_URL);
            inviteText
                = inviteText.replace(/\{MEETING_ID\}/g, this.event.meetingId);
            if (dialInID) {
                inviteText
                    = inviteText.replace(/\{DIALIN_ID\}/g, dialInID);
            }
        }

        return inviteText;
    }

    /**
     * Updates the initial button text and click handler when there is
     * no meeting scheduled.
     */
    updateInitialButtonURL(location: LocationWrapper) {
        var button = $('#jitsi_button a');
        button.html('Add a ' + LOCATION_TEXT);
        button.attr('href', '#');
        button.on('click', e => {
            e.preventDefault();
            this.clickAddMeeting(false, location);
        });
    }

    /**
     * Updates the url for the button.
     */
    updateButtonURL() {
        try {
            var button = $('#jitsi_button a');
            button.html("Join your " + LOCATION_TEXT + " now");
            button.off('click');
            button.attr('href', BASE_URL + this.event.meetingId);
            button.attr('target', '_new');
        } catch (e) {
            console.log(e);
        }
    }
}




/**
 * The new google calendar specific implementation of the event page.
 */
class G2Event extends EventContainer {
    constructor(eventEditPage: HTMLElement) {
        super();

        this.container = eventEditPage;
    }

    /**
     * Updates content (adds the button if is not there).
     * This is the entry point for all page modifications.
     */
    update() {
        // we want to trigger all the logic only when we have enough elements
        // on the page, as the new interface is loading live and some elements
        // are missing when directly go the event edit page
        // we require the notifications element and location or description
        // element
        if ($('#xNtList').length != 0    // notifications
            && (
                $("#xLocIn").length != 0 // editable location
                || $('#xOnCal').length != 0     // readonly location
                || $('#xDescIn').length != 0    // editable description
                || $('#xDesc').length != 0      // readonly description
            )
            && !this.isButtonPresent()) {
            this.updateMeetingId();
            this.addJitsiButton();
        }
    }

    /**
     * The event location.
     * @returns {GLocation}
     */
    get location() {
        if (!this.locationInstance) {
            this.locationInstance = new G2Location();
        }
        return this.locationInstance;
    }

    /**
     * The button container holding jitsi button.
     */
    get buttonContainer() {

        // we will create a new raw to place the button
        // this row will be before the notifications row
        let neighbor = $('#xNtList').parent();
        if(neighbor.length == 0){
            return null;
        }

        let buttonContainer = $('#jitsi_button_container');
        if (buttonContainer.length !== 0) {
            return buttonContainer.find('content');
        }

        const newRow = $('<div class = "FrSOzf" />')
        newRow.append(`
            <div class = "tzcF6">
                <div class = "DPvwYc jitsi_edit_page_icon"/>
            </div>
        `)

        newRow.append(`
            <div class = "j3nyw">
                <div class = "BY5aAd">
                    <div role = "button"
                        class = "uArJ5e UQuaGc Y5sE8d"
                        id="jitsi_button_container">
                        <content class = "CwaK9">
                            <span id="jitsi_button"
                                    class="RveJvd snByac">
                            </span>
                        </content>
                    </div>
                </div>
            </div>
        `)

        newRow.insertBefore(neighbor);

        return newRow.find('content');
    }

    /**
     * Adds the jitsi button in buttonContainer.
     */
    addJitsiButton() {
        var container = this.buttonContainer;
        if (!container)
            return false;

        this.description?.update(this.location);
    }

    /**
     * The event description.
     * @returns {G2Description}
     */
    get description() {
        if (!this.descriptionInstance)
            this.descriptionInstance = new G2Description(this);
        return this.descriptionInstance;
    }
}

/**
 * The google calendar specific implementation of the location field in the
 * event page.
 */
class G2Location extends LocationWrapper {

    _getSelector() {
        return $("#xLocIn input[jsname=YPqjbf][role=combobox]");
    }

    _getLocationElement() {
        let elem = this._getSelector();

        if (elem.length === 0) {
            // this is the case where location is not editable
            let element = $('#xOnCal')[0];

            if (!element) {
                return undefined;
            }

            return {
                val: () => element.innerHTML
            }
        }

        return elem;
    }

    /**
     * The text from the location input field.
     */
    get text(): string | undefined {
        let e = this._getLocationElement();

        if (e)
        // BUG BUG BUG!
            return e.val() as any;
        else
            return undefined;
    }

    /**
     * Adds text to location input.
     * @param text
     */
    addLocationText(text: string){
        let elem = this._getSelector();

        // in case this element is missing, means we cannot edit the text
        if (elem.length === 0)
            return;

        // Set the location if there is content
        let locationNode = elem[0] as any; // GT BUG BUG BUG
        if (locationNode) {
            locationNode.focus(); // Focus needed to make a simulation of keying in.
            elem.attr(
                'value',
                locationNode.value === '' ?
                    text : locationNode.value + ', ' + text);
            locationNode.dispatchEvent(getKeyboardEvent('input'));
            // tried many combinations and cannot make it reliably working
            // in some cases hovering over the input will make it save,
            // otherwise text is seen in the input but is not saved after
            // clicking save
            window.setTimeout(function(){
                locationNode.focus();
                elem.val(elem.val()+ " ");
                locationNode.dispatchEvent(getKeyboardEvent('input'));
            },1000);
        }
    }
}

/**
 * The google calendar specific implementation of the description textarea in
 * the event page.
 */
class G2Description extends DescriptionWrapper {

    /**
     * The html element.
     */
    get element(): any {
        var description = $('#xDescIn > [role="textbox"]');
        if (!description || description.length == 0) {
            // maybe it is not editable
            description = $('#xDesc > div');
            // BUG BUG BUG not found description.notEditable = true;
        }

        return description;
    }

    /**
     * The text value of the description.
     */
    get value() {
        return this.element.text();
    }

    /**
     * Adds text to the description.
     * @param text
     */
    addDescriptionText(text: string){
        let el = this.element;
        if (el.notEditable)
            return;

        let descriptionNode = el[0];
        descriptionNode.dispatchEvent(getKeyboardEvent('keydown'));
        descriptionNode.dispatchEvent(getKeyboardEvent('keypress'));

        // format new lines
        let textToInsert = text.replace(/(?:\r\n|\r|\n)/g, '<br />');

        // if there is already text in the description append on new line
        if (el.text().length > 0) {
            el.append('<br/><br/>');
        }
        el.append(textToInsert);

        descriptionNode.dispatchEvent(getKeyboardEvent('input'));
        descriptionNode.dispatchEvent(getKeyboardEvent('keyup'));
    }

    /**
     * Updates the initial button text and click handler when there is
     * no meeting scheduled.
     */
    updateInitialButtonURL(location: LocationWrapper) {
        let button = $('#jitsi_button');
        button.html('Add a ' + LOCATION_TEXT);

        let container = this.event.buttonContainer;

        container.parent().off('click');
        container.parent().on('click', (e: MouseEvent) => {
            e.preventDefault();

            this.clickAddMeeting(false, location);
        });
    }

    /**
     * Updates the url for the button.
     */
    updateButtonURL() {
        try {
            var button = $('#jitsi_button');
            button.html("Join your " + LOCATION_TEXT + " now");

            var container = this.event.buttonContainer;

            container.parent().off('click');
            container.parent().on('click', (e: MouseEvent) => {
                e.preventDefault();

                // call updateMeetingId, the case where somebody edited location
                // and then click join now before saving
                this.event.updateMeetingId();

                window.open(BASE_URL + this.event.meetingId, '_blank');
            });
        } catch (e) {
            console.log(e);
        }
    }
}


/**
 * Returns the node id.
 */
function getNodeID(name: string) {
    return '#\\' + getNodePrefix() + '\\.' + name;
}

/**
 * Returns the prefix to use for nodes.
 */
function getNodePrefix(): string {
    var labelNode = $("[id*='location-label']");
    if (labelNode.length >= 1) {
        return labelNode[0].id.split('.')[0];
    }
    return '';
}

/**
 * Returns an event object that can be used to be simulated
 */
function getKeyboardEvent(eventType: string) {
    return new KeyboardEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        keyCode: 32,
        charCode: 0
    })
}

/**
 * Finds a parameter in the page url parameters.
 * @param parameterName the name of the param to search for
 * @returns {String} the parameter value.
 */
function findGetParameter(parameterName: string): string | null {
    var result = null,
        tmp = [];
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
            tmp = item.split("=");
            if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
        });
    return result;
}

/**
 * Checks whether it is ok to add the button to current page
 * in case of new google calendar interface
 */
function checkAndUpdateCalendarG2() {
    var MutationObserver = window.MutationObserver;
    var c = EventContainer.getInstance();
    if (c) {

        // anyway try to add the button, this is the case when directly going
        // to create event page
        if(document.querySelector('body')?.dataset.viewfamily === 'EVENT_EDIT'
            && !c.isButtonPresent()) {
            // popup adds autoCreateMeeting param when open directly event
            // create page
            if (findGetParameter('autoCreateMeeting')
                && findGetParameter('extid') === chrome.runtime.id) {
                c.scheduleAutoCreateMeeting = true;
            }

            c.update();
        }

        // Listen for mutations (showing the bubble), for quick adding events
        var body = document.querySelector('body')!;
        new MutationObserver(function(mutations) {

            // the main calendar view
            if (document.querySelector('body')?.dataset.viewfamily === 'EVENT') {
                mutations.forEach(function (mutation) {
                    var mel = mutation.addedNodes[0];
                    var newElement = mel && (mel as HTMLElement).innerHTML;

                    if (newElement
                        && (newElement.search('role=\"dialog\"') !== -1)) {

                        // skip if our button is already added
                        if ($('#jitsi_button_quick_add').length != 0) {
                            return;
                        }

                        var tabEvent = $(mel).find("#tabEvent");
                        if (tabEvent.length > 0) {
                            const container = $('<content class="" role="tabpanel" id="jitsi_button_quick_add_content"><div class="fy8IH poWrGb"/></content>')
                            $(tabEvent.parent()).append(container);

                            container.children().first().append(`
                                <div class="FkXdCf HyA7Fb">
                                    <div class="DPvwYc QusFJf jitsi_quick_add_icon"/>
                                </div>
                            `)

                            container.children().first().append(`
                                <div class="mH89We">
                                    <div role="button"
                                        class="uArJ5e UQuaGc Y5sE8d"
                                        id="jitsi_button_quick_add">
                                        <content class="CwaK9">\
                                            <span class="RveJvd jitsi_quick_add_text_size">
                                                Add a ${LOCATION_TEXT}
                                            </span>
                                        </content>
                                    </div>
                                </div>
                            `)

                            var clickHandler
                                = container.find(
                                    '#jitsi_button_quick_add');
                            clickHandler.on('click', function (e) {
                                c!.scheduleAutoCreateMeeting = true;
                                $('div[role="button"][jsname="rhPddf"]').click();
                            });

                            return;
                        }
                    }
                });
            } else if (document.querySelector('body')?.dataset.viewfamily
                === 'EVENT_EDIT') {
                c!.update();
            }
        }).observe(
            body, {
                attributes: false,
                childList: true,
                characterData: false,
                subtree : true
            });
    }
}

log("Welcome from the extension!");

if (document.querySelector('body')?.dataset.viewfamily) {
    // this is google calendar new interface
    log("connecting to gcal!");
        checkAndUpdateCalendarG2();
}

function log(msg: string, ...data: any[]) {
    console.log(msg, ...data);
}