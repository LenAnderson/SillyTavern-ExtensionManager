async function getWorldEntry(name, data, entry) {
    if (!data.entries[entry.uid]) {
        return;
    }

    const template = WI_ENTRY_EDIT_TEMPLATE.clone();
    template.data('uid', entry.uid);
    template.attr('uid', entry.uid);

    // Init default state of WI Key toggle (=> true)
    if (typeof power_user.wi_key_input_plaintext === 'undefined') power_user.wi_key_input_plaintext = true;

    /** Function to build the keys input controls @param {string} entryPropName @param {string} originalDataValueName */
    function enableKeysInput(entryPropName, originalDataValueName) {
        const isFancyInput = !isMobile() && !power_user.wi_key_input_plaintext;
        const input = isFancyInput ? template.find(`select[name="${entryPropName}"]`) : template.find(`textarea[name="${entryPropName}"]`);
        input.data('uid', entry.uid);
        input.on('click', function (event) {
            // Prevent closing the drawer on clicking the input
            event.stopPropagation();
        });

        function templateStyling(/** @type {Select2Option} */ item, { searchStyle = false } = {}) {
            const content = $('<span>').addClass('item').text(item.text).attr('title', `${item.text}\n\nClick to edit`);
            const isRegex = isValidRegex(item.text);
            if (isRegex) {
                content.html(highlightRegex(item.text));
                content.addClass('regex_item').prepend($('<span>').addClass('regex_icon').text('•*').attr('title', 'Regex'));
            }

            if (searchStyle && item.count) {
                // Build a wrapping element
                const wrapper = $('<span>').addClass('result_block')
                    .append(content);
                wrapper.append($('<span>').addClass('item_count').text(item.count).attr('title', `Used as a key ${item.count} ${item.count != 1 ? 'times' : 'time'} in this lorebook`));
                return wrapper;
            }

            return content;
        }

        if (isFancyInput) {
            // First initialize existing values as options, before initializing select2, to speed up performance
            select2ModifyOptions(input, entry[entryPropName], { select: true, changeEventArgs: { skipReset: true, noSave: true } });

            input.select2({
                ajax: dynamicSelect2DataViaAjax(() => worldEntryKeyOptionsCache),
                tags: true,
                tokenSeparators: [','],
                tokenizer: customTokenizer,
                placeholder: input.attr('placeholder'),
                templateResult: item => templateStyling(item, { searchStyle: true }),
                templateSelection: item => templateStyling(item),
            });
            input.on('change', async function (_, { skipReset, noSave } = {}) {
                const uid = $(this).data('uid');
                /** @type {string[]} */
                const keys = ($(this).select2('data')).map(x => x.text);

                !skipReset && await resetScrollHeight(this);
                if (!noSave) {
                    data.entries[uid][entryPropName] = keys;
                    setWIOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                    await saveWorldInfo(name, data);
                }
            });
            input.on('select2:select', /** @type {function(*):void} */ event => updateWorldEntryKeyOptionsCache([event.params.data]));
            input.on('select2:unselect', /** @type {function(*):void} */ event => updateWorldEntryKeyOptionsCache([event.params.data], { remove: true }));

            select2ChoiceClickSubscribe(input, target => {
                const key = $(target.closest('.regex-highlight, .item')).text();
                console.debug('Editing WI key', key);

                // Remove the current key from the actual selection
                const selected = input.val();
                if (!Array.isArray(selected)) return;
                var index = selected.indexOf(getSelect2OptionId(key));
                if (index > -1) selected.splice(index, 1);
                input.val(selected).trigger('change');
                // Manually update the cache, that change event is not gonna trigger it
                updateWorldEntryKeyOptionsCache([key], { remove: true });

                // We need to "hack" the actual text input into the currently open textarea
                input.next('span.select2-container').find('textarea')
                    .val(key).trigger('input');
            }, { openDrawer: true });
        }
        else {
            // Compatibility with mobile devices. On mobile we need a text input field, not a select option control, so we need its own event handlers
            template.find(`select[name="${entryPropName}"]`).hide();
            input.show();

            input.on('input', async function (_, { skipReset, noSave } = {}) {
                const uid = $(this).data('uid');
                const value = String($(this).val());
                !skipReset && await resetScrollHeight(this);
                if (!noSave) {
                    data.entries[uid][entryPropName] = splitKeywordsAndRegexes(value);
                    setWIOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                    await saveWorldInfo(name, data);
                }
            });
            input.val(entry[entryPropName].join(', ')).trigger('input', { skipReset: true });
        }
        return { isFancy: isFancyInput, control: input };
    }

    // key
    const keyInput = enableKeysInput('key', 'keys');

    // keysecondary
    const keySecondaryInput = enableKeysInput('keysecondary', 'secondary_keys');

    // draw key input switch button
    template.find('.switch_input_type_icon').on('click', function () {
        power_user.wi_key_input_plaintext = !power_user.wi_key_input_plaintext;
        saveSettingsDebounced();

        // Just redraw the panel
        const uid = ($(this).parents('.world_entry')).data('uid');
        updateEditor(uid, false);

        $(`.world_entry[uid="${uid}"] .inline-drawer-icon`).trigger('click');
        // setTimeout(() => {
        // }, debounce_timeout.standard);
    }).each((_, icon) => {
        $(icon).attr('title', $(icon).data(power_user.wi_key_input_plaintext ? 'tooltip-on' : 'tooltip-off'));
        $(icon).text($(icon).data(power_user.wi_key_input_plaintext ? 'icon-on' : 'icon-off'));
    });

    // logic AND/NOT
    const selectiveLogicDropdown = template.find('select[name="entryLogicType"]');
    selectiveLogicDropdown.data('uid', entry.uid);

    selectiveLogicDropdown.on('click', function (event) {
        event.stopPropagation();
    });

    selectiveLogicDropdown.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].selectiveLogic = !isNaN(value) ? value : world_info_logic.AND_ANY;
        setWIOriginalDataValue(data, uid, 'selectiveLogic', data.entries[uid].selectiveLogic);
        await saveWorldInfo(name, data);
    });

    template
        .find(`select[name="entryLogicType"] option[value=${entry.selectiveLogic}]`)
        .prop('selected', true)
        .trigger('input');

    // Character filter
    const characterFilterLabel = template.find('label[for="characterFilter"] > small');
    characterFilterLabel.text(entry.characterFilter?.isExclude ? 'Exclude Character(s)' : 'Filter to Character(s)');

    // exclude characters checkbox
    const characterExclusionInput = template.find('input[name="character_exclusion"]');
    characterExclusionInput.data('uid', entry.uid);
    characterExclusionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        characterFilterLabel.text(value ? 'Exclude Character(s)' : 'Filter to Character(s)');
        if (data.entries[uid].characterFilter) {
            if (!value && data.entries[uid].characterFilter.names.length === 0 && data.entries[uid].characterFilter.tags.length === 0) {
                delete data.entries[uid].characterFilter;
            } else {
                data.entries[uid].characterFilter.isExclude = value;
            }
        } else if (value) {
            Object.assign(
                data.entries[uid],
                {
                    characterFilter: {
                        isExclude: true,
                        names: [],
                        tags: [],
                    },
                },
            );
        }

        // Verify names to exist in the system
        if (data.entries[uid]?.characterFilter?.names?.length > 0) {
            for (const name of [...data.entries[uid].characterFilter.names]) {
                if (!getContext().characters.find(x => x.avatar.replace(/\.[^/.]+$/, '') === name)) {
                    console.warn(`World Info: Character ${name} not found. Removing from the entry filter.`, entry);
                    data.entries[uid].characterFilter.names = data.entries[uid].characterFilter.names.filter(x => x !== name);
                }
            }
        }

        setWIOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
        await saveWorldInfo(name, data);
    });
    characterExclusionInput.prop('checked', entry.characterFilter?.isExclude ?? false).trigger('input');

    const characterFilter = template.find('select[name="characterFilter"]');
    characterFilter.data('uid', entry.uid);

    if (!isMobile()) {
        $(characterFilter).select2({
            width: '100%',
            placeholder: 'Tie this entry to specific characters or characters with specific tags',
            allowClear: true,
            closeOnSelect: false,
        });
    }

    const characters = getContext().characters;
    characters.forEach((character) => {
        const option = document.createElement('option');
        const name = character.avatar.replace(/\.[^/.]+$/, '') ?? character.name;
        option.innerText = name;
        option.selected = entry.characterFilter?.names?.includes(name);
        option.setAttribute('data-type', 'character');
        characterFilter.append(option);
    });

    const tags = getContext().tags;
    tags.forEach((tag) => {
        const option = document.createElement('option');
        option.innerText = `[Tag] ${tag.name}`;
        option.selected = entry.characterFilter?.tags?.includes(tag.id);
        option.value = tag.id;
        option.setAttribute('data-type', 'tag');
        characterFilter.append(option);
    });

    characterFilter.on('mousedown change', async function (e) {
        // If there's no world names, don't do anything
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }

        const uid = $(this).data('uid');
        const selected = $(this).find(':selected');
        if ((!selected || selected?.length === 0) && !data.entries[uid].characterFilter?.isExclude) {
            delete data.entries[uid].characterFilter;
        } else {
            const names = selected.filter('[data-type="character"]').map((_, e) => e instanceof HTMLOptionElement && e.innerText).toArray();
            const tags = selected.filter('[data-type="tag"]').map((_, e) => e instanceof HTMLOptionElement && e.value).toArray();
            Object.assign(
                data.entries[uid],
                {
                    characterFilter: {
                        isExclude: data.entries[uid].characterFilter?.isExclude ?? false,
                        names: names,
                        tags: tags,
                    },
                },
            );
        }
        setWIOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
        await saveWorldInfo(name, data);
    });

    // comment
    const commentInput = template.find('textarea[name="comment"]');
    const commentToggle = template.find('input[name="addMemo"]');
    commentInput.data('uid', entry.uid);
    commentInput.on('input', async function (_, { skipReset } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        !skipReset && await resetScrollHeight(this);
        data.entries[uid].comment = value;

        setWIOriginalDataValue(data, uid, 'comment', data.entries[uid].comment);
        await saveWorldInfo(name, data);
    });
    commentToggle.data('uid', entry.uid);
    commentToggle.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        //console.log(value)
        const commentContainer = $(this)
            .closest('.world_entry')
            .find('.commentContainer');
        data.entries[uid].addMemo = value;
        await saveWorldInfo(name, data);
        value ? commentContainer.show() : commentContainer.hide();
    });

    commentInput.val(entry.comment).trigger('input', { skipReset: true });
    //initScrollHeight(commentInput);
    commentToggle.prop('checked', true /* entry.addMemo */).trigger('input');
    commentToggle.parent().hide();

    // content
    const counter = template.find('.world_entry_form_token_counter');
    const countTokensDebounced = debounce(async function (counter, value) {
        const numberOfTokens = await getTokenCountAsync(value);
        $(counter).text(numberOfTokens);
    }, debounce_timeout.relaxed);

    const contentInput = template.find('textarea[name="content"]');
    contentInput.data('uid', entry.uid);
    contentInput.on('input', async function (_, { skipCount } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        data.entries[uid].content = value;

        setWIOriginalDataValue(data, uid, 'content', data.entries[uid].content);
        await saveWorldInfo(name, data);

        if (skipCount) {
            return;
        }

        // count tokens
        countTokensDebounced(counter, value);
    });
    contentInput.val(entry.content).trigger('input', { skipCount: true });
    //initScrollHeight(contentInput);

    template.find('.inline-drawer-toggle').on('click', function () {
        if (counter.data('first-run')) {
            counter.data('first-run', false);
            countTokensDebounced(counter, contentInput.val());
            if (!keyInput.isFancy) initScrollHeight(keyInput.control);
            if (!keySecondaryInput.isFancy) initScrollHeight(keySecondaryInput.control);
        }
    });

    // selective
    const selectiveInput = template.find('input[name="selective"]');
    selectiveInput.data('uid', entry.uid);
    selectiveInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].selective = value;

        setWIOriginalDataValue(data, uid, 'selective', data.entries[uid].selective);
        await saveWorldInfo(name, data);

        const keysecondary = $(this)
            .closest('.world_entry')
            .find('.keysecondary');

        const keysecondarytextpole = $(this)
            .closest('.world_entry')
            .find('.keysecondarytextpole');

        const keyprimaryselect = $(this)
            .closest('.world_entry')
            .find('.keyprimaryselect');

        const keyprimaryHeight = keyprimaryselect.outerHeight();
        keysecondarytextpole.css('height', keyprimaryHeight + 'px');

        value ? keysecondary.show() : keysecondary.hide();

    });
    //forced on, ignored if empty
    selectiveInput.prop('checked', true /* entry.selective */).trigger('input');
    selectiveInput.parent().hide();


    // constant
    /*
    const constantInput = template.find('input[name="constant"]');
    constantInput.data("uid", entry.uid);
    constantInput.on("input", async function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].constant = value;
        setOriginalDataValue(data, uid, "constant", data.entries[uid].constant);
        await saveWorldInfo(name, data);
    });
    constantInput.prop("checked", entry.constant).trigger("input");
    */

    // order
    const orderInput = template.find('input[name="order"]');
    orderInput.data('uid', entry.uid);
    orderInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].order = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid);
        setWIOriginalDataValue(data, uid, 'insertion_order', data.entries[uid].order);
        await saveWorldInfo(name, data);
    });
    orderInput.val(entry.order).trigger('input');
    orderInput.css('width', 'calc(3em + 15px)');

    // group
    const groupInput = template.find('input[name="group"]');
    groupInput.data('uid', entry.uid);
    groupInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = String($(this).val()).trim();

        data.entries[uid].group = value;
        setWIOriginalDataValue(data, uid, 'extensions.group', data.entries[uid].group);
        await saveWorldInfo(name, data);
    });
    groupInput.val(entry.group ?? '').trigger('input');
    setTimeout(() => createEntryInputAutocomplete(groupInput, getInclusionGroupCallback(data), { allowMultiple: true }), 1);

    // inclusion priority
    const groupOverrideInput = template.find('input[name="groupOverride"]');
    groupOverrideInput.data('uid', entry.uid);
    groupOverrideInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].groupOverride = value;
        setWIOriginalDataValue(data, uid, 'extensions.group_override', data.entries[uid].groupOverride);
        await saveWorldInfo(name, data);
    });
    groupOverrideInput.prop('checked', entry.groupOverride).trigger('input');

    // group weight
    const groupWeightInput = template.find('input[name="groupWeight"]');
    groupWeightInput.data('uid', entry.uid);
    groupWeightInput.on('input', async function () {
        const uid = $(this).data('uid');
        let value = Number($(this).val());
        const min = Number($(this).attr('min'));
        const max = Number($(this).attr('max'));

        // Clamp the value
        if (value < min) {
            value = min;
            $(this).val(min);
        } else if (value > max) {
            value = max;
            $(this).val(max);
        }

        data.entries[uid].groupWeight = !isNaN(value) ? Math.abs(value) : 1;
        setWIOriginalDataValue(data, uid, 'extensions.group_weight', data.entries[uid].groupWeight);
        await saveWorldInfo(name, data);
    });
    groupWeightInput.val(entry.groupWeight ?? DEFAULT_WEIGHT).trigger('input');

    // sticky
    const sticky = template.find('input[name="sticky"]');
    sticky.data('uid', entry.uid);
    sticky.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].sticky = !isNaN(value) ? value : null;

        setWIOriginalDataValue(data, uid, 'extensions.sticky', data.entries[uid].sticky);
        await saveWorldInfo(name, data);
    });
    sticky.val(entry.sticky > 0 ? entry.sticky : '').trigger('input');

    // cooldown
    const cooldown = template.find('input[name="cooldown"]');
    cooldown.data('uid', entry.uid);
    cooldown.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].cooldown = !isNaN(value) ? value : null;

        setWIOriginalDataValue(data, uid, 'extensions.cooldown', data.entries[uid].cooldown);
        await saveWorldInfo(name, data);
    });
    cooldown.val(entry.cooldown > 0 ? entry.cooldown : '').trigger('input');

    // delay
    const delay = template.find('input[name="delay"]');
    delay.data('uid', entry.uid);
    delay.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].delay = !isNaN(value) ? value : null;

        setWIOriginalDataValue(data, uid, 'extensions.delay', data.entries[uid].delay);
        await saveWorldInfo(name, data);
    });
    delay.val(entry.delay > 0 ? entry.delay : '').trigger('input');

    // probability
    if (entry.probability === undefined) {
        entry.probability = null;
    }

    // depth
    const depthInput = template.find('input[name="depth"]');
    depthInput.data('uid', entry.uid);

    depthInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].depth = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid);
        setWIOriginalDataValue(data, uid, 'extensions.depth', data.entries[uid].depth);
        await saveWorldInfo(name, data);
    });
    depthInput.val(entry.depth ?? DEFAULT_DEPTH).trigger('input');
    depthInput.css('width', 'calc(3em + 15px)');

    // Hide by default unless depth is specified
    if (entry.position === world_info_position.atDepth) {
        //depthInput.parent().hide();
    }

    const probabilityInput = template.find('input[name="probability"]');
    probabilityInput.data('uid', entry.uid);
    probabilityInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].probability = !isNaN(value) ? value : null;

        // Clamp probability to 0-100
        if (data.entries[uid].probability !== null) {
            data.entries[uid].probability = Math.min(100, Math.max(0, data.entries[uid].probability));

            if (data.entries[uid].probability !== value) {
                $(this).val(data.entries[uid].probability);
            }
        }

        setWIOriginalDataValue(data, uid, 'extensions.probability', data.entries[uid].probability);
        await saveWorldInfo(name, data);
    });
    probabilityInput.val(entry.probability).trigger('input');
    probabilityInput.css('width', 'calc(3em + 15px)');

    // probability toggle
    if (entry.useProbability === undefined) {
        entry.useProbability = false;
    }

    const probabilityToggle = template.find('input[name="useProbability"]');
    probabilityToggle.data('uid', entry.uid);
    probabilityToggle.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].useProbability = value;
        const probabilityContainer = $(this)
            .closest('.world_entry')
            .find('.probabilityContainer');
        await saveWorldInfo(name, data);
        value ? probabilityContainer.show() : probabilityContainer.hide();

        if (value && data.entries[uid].probability === null) {
            data.entries[uid].probability = 100;
        }

        if (!value) {
            data.entries[uid].probability = null;
        }

        probabilityInput.val(data.entries[uid].probability).trigger('input');
    });
    //forced on, 100% by default
    probabilityToggle.prop('checked', true /* entry.useProbability */).trigger('input');
    probabilityToggle.parent().hide();

    // position
    if (entry.position === undefined) {
        entry.position = 0;
    }

    const positionInput = template.find('select[name="position"]');
    //initScrollHeight(positionInput);
    positionInput.data('uid', entry.uid);
    positionInput.on('click', function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });
    positionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].position = !isNaN(value) ? value : 0;
        if (value === world_info_position.atDepth) {
            depthInput.prop('disabled', false);
            depthInput.css('visibility', 'visible');
            //depthInput.parent().show();
            const role = Number($(this).find(':selected').data('role'));
            data.entries[uid].role = role;
        } else {
            depthInput.prop('disabled', true);
            depthInput.css('visibility', 'hidden');
            data.entries[uid].role = null;
            //depthInput.parent().hide();
        }
        updatePosOrdDisplay(uid);
        // Spec v2 only supports before_char and after_char
        setWIOriginalDataValue(data, uid, 'position', data.entries[uid].position == 0 ? 'before_char' : 'after_char');
        // Write the original value as extensions field
        setWIOriginalDataValue(data, uid, 'extensions.position', data.entries[uid].position);
        setWIOriginalDataValue(data, uid, 'extensions.role', data.entries[uid].role);
        await saveWorldInfo(name, data);
    });

    const roleValue = entry.position === world_info_position.atDepth ? String(entry.role ?? extension_prompt_roles.SYSTEM) : '';
    template
        .find(`select[name="position"] option[value=${entry.position}][data-role="${roleValue}"]`)
        .prop('selected', true)
        .trigger('input');

    //add UID above content box (less important doesn't need to be always visible)
    template.find('.world_entry_form_uid_value').text(`(UID: ${entry.uid})`);

    //new tri-state selector for constant/normal/vectorized
    const entryStateSelector = template.find('select[name="entryStateSelector"]');
    entryStateSelector.data('uid', entry.uid);
    entryStateSelector.on('click', function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });
    entryStateSelector.on('input', async function () {
        const uid = entry.uid;
        const value = $(this).val();
        switch (value) {
            case 'constant':
                data.entries[uid].constant = true;
                data.entries[uid].vectorized = false;
                setWIOriginalDataValue(data, uid, 'constant', true);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', false);
                break;
            case 'normal':
                data.entries[uid].constant = false;
                data.entries[uid].vectorized = false;
                setWIOriginalDataValue(data, uid, 'constant', false);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', false);
                break;
            case 'vectorized':
                data.entries[uid].constant = false;
                data.entries[uid].vectorized = true;
                setWIOriginalDataValue(data, uid, 'constant', false);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', true);
                break;
        }
        await saveWorldInfo(name, data);

    });

    const entryKillSwitch = template.find('div[name="entryKillSwitch"]');
    entryKillSwitch.data('uid', entry.uid);
    entryKillSwitch.on('click', async function (event) {
        const uid = entry.uid;
        data.entries[uid].disable = !data.entries[uid].disable;
        const isActive = !data.entries[uid].disable;
        setWIOriginalDataValue(data, uid, 'enabled', isActive);
        template.toggleClass('disabledWIEntry', !isActive);
        entryKillSwitch.toggleClass('fa-toggle-off', !isActive);
        entryKillSwitch.toggleClass('fa-toggle-on', isActive);
        await saveWorldInfo(name, data);

    });

    const entryState = function () {
        if (entry.constant === true) {
            return 'constant';
        } else if (entry.vectorized === true) {
            return 'vectorized';
        } else {
            return 'normal';
        }
    };

    const isActive = !entry.disable;
    template.toggleClass('disabledWIEntry', !isActive);
    entryKillSwitch.toggleClass('fa-toggle-off', !isActive);
    entryKillSwitch.toggleClass('fa-toggle-on', isActive);

    template
        .find(`select[name="entryStateSelector"] option[value=${entryState()}]`)
        .prop('selected', true)
        .trigger('input');

    // exclude recursion
    const excludeRecursionInput = template.find('input[name="exclude_recursion"]');
    excludeRecursionInput.data('uid', entry.uid);
    excludeRecursionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].excludeRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.exclude_recursion', data.entries[uid].excludeRecursion);
        await saveWorldInfo(name, data);
    });
    excludeRecursionInput.prop('checked', entry.excludeRecursion).trigger('input');

    // prevent recursion
    const preventRecursionInput = template.find('input[name="prevent_recursion"]');
    preventRecursionInput.data('uid', entry.uid);
    preventRecursionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].preventRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.prevent_recursion', data.entries[uid].preventRecursion);
        await saveWorldInfo(name, data);
    });
    preventRecursionInput.prop('checked', entry.preventRecursion).trigger('input');

    // delay until recursion
    // delay until recursion level
    const delayUntilRecursionInput = template.find('input[name="delay_until_recursion"]');
    delayUntilRecursionInput.data('uid', entry.uid);
    const delayUntilRecursionLevelInput = template.find('input[name="delayUntilRecursionLevel"]');
    delayUntilRecursionLevelInput.data('uid', entry.uid);
    delayUntilRecursionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const toggled = $(this).prop('checked');

        // If the value contains a number, we'll take that one (set by the level input), otherwise we can use true/false switch
        const value = toggled ? data.entries[uid].delayUntilRecursion || true : false;

        if (!toggled) delayUntilRecursionLevelInput.val('');

        data.entries[uid].delayUntilRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.delay_until_recursion', data.entries[uid].delayUntilRecursion);
        await saveWorldInfo(name, data);
    });
    delayUntilRecursionInput.prop('checked', entry.delayUntilRecursion).trigger('input');
    delayUntilRecursionLevelInput.on('input', async function () {
        const uid = $(this).data('uid');
        const content = $(this).val();
        const value = content === '' ? (typeof data.entries[uid].delayUntilRecursion === 'boolean' ? data.entries[uid].delayUntilRecursion : true)
            : content === 1 ? true
                : !isNaN(Number(content)) ? Number(content)
                    : false;

        data.entries[uid].delayUntilRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.delay_until_recursion', data.entries[uid].delayUntilRecursion);
        await saveWorldInfo(name, data);
    });
    // No need to retrigger inpout event, we'll just set the curret current value. It was edited/saved above already
    delayUntilRecursionLevelInput.val(['number', 'string'].includes(typeof entry.delayUntilRecursion) ? entry.delayUntilRecursion : '').trigger('input');

    // duplicate button
    const duplicateButton = template.find('.duplicate_entry_button');
    duplicateButton.data('uid', entry.uid);
    duplicateButton.on('click', async function () {
        const uid = $(this).data('uid');
        const entry = duplicateWorldInfoEntry(data, uid);
        if (entry) {
            await saveWorldInfo(name, data);
            updateEditor(entry.uid);
        }
    });

    // delete button
    const deleteButton = template.find('.delete_entry_button');
    deleteButton.data('uid', entry.uid);
    deleteButton.on('click', async function (e) {
        e.stopPropagation();
        const uid = $(this).data('uid');
        const deleted = await deleteWorldInfoEntry(data, uid);
        if (!deleted) return;
        deleteWIOriginalDataValue(data, uid);
        await saveWorldInfo(name, data);
        updateEditor(navigation_option.previous);
    });

    // scan depth
    const scanDepthInput = template.find('input[name="scanDepth"]');
    scanDepthInput.data('uid', entry.uid);
    scanDepthInput.on('input', async function () {
        const uid = $(this).data('uid');
        const isEmpty = $(this).val() === '';
        const value = Number($(this).val());

        // Clamp if necessary
        if (value < 0) {
            $(this).val(0).trigger('input');
            toastr.warning('Scan depth cannot be negative');
            return;
        }

        if (value > MAX_SCAN_DEPTH) {
            $(this).val(MAX_SCAN_DEPTH).trigger('input');
            toastr.warning(`Scan depth cannot exceed ${MAX_SCAN_DEPTH}`);
            return;
        }

        data.entries[uid].scanDepth = !isEmpty && !isNaN(value) && value >= 0 && value <= MAX_SCAN_DEPTH ? Math.floor(value) : null;
        setWIOriginalDataValue(data, uid, 'extensions.scan_depth', data.entries[uid].scanDepth);
        await saveWorldInfo(name, data);
    });
    scanDepthInput.val(entry.scanDepth ?? null).trigger('input');

    // case sensitive select
    const caseSensitiveSelect = template.find('select[name="caseSensitive"]');
    caseSensitiveSelect.data('uid', entry.uid);
    caseSensitiveSelect.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].caseSensitive = value === 'null' ? null : value === 'true';
        setWIOriginalDataValue(data, uid, 'extensions.case_sensitive', data.entries[uid].caseSensitive);
        await saveWorldInfo(name, data);
    });
    caseSensitiveSelect.val((entry.caseSensitive === null || entry.caseSensitive === undefined) ? 'null' : entry.caseSensitive ? 'true' : 'false').trigger('input');

    // match whole words select
    const matchWholeWordsSelect = template.find('select[name="matchWholeWords"]');
    matchWholeWordsSelect.data('uid', entry.uid);
    matchWholeWordsSelect.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].matchWholeWords = value === 'null' ? null : value === 'true';
        setWIOriginalDataValue(data, uid, 'extensions.match_whole_words', data.entries[uid].matchWholeWords);
        await saveWorldInfo(name, data);
    });
    matchWholeWordsSelect.val((entry.matchWholeWords === null || entry.matchWholeWords === undefined) ? 'null' : entry.matchWholeWords ? 'true' : 'false').trigger('input');

    // use group scoring select
    const useGroupScoringSelect = template.find('select[name="useGroupScoring"]');
    useGroupScoringSelect.data('uid', entry.uid);
    useGroupScoringSelect.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].useGroupScoring = value === 'null' ? null : value === 'true';
        setWIOriginalDataValue(data, uid, 'extensions.use_group_scoring', data.entries[uid].useGroupScoring);
        await saveWorldInfo(name, data);
    });
    useGroupScoringSelect.val((entry.useGroupScoring === null || entry.useGroupScoring === undefined) ? 'null' : entry.useGroupScoring ? 'true' : 'false').trigger('input');

    // automation id
    const automationIdInput = template.find('input[name="automationId"]');
    automationIdInput.data('uid', entry.uid);
    automationIdInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].automationId = value;
        setWIOriginalDataValue(data, uid, 'extensions.automation_id', data.entries[uid].automationId);
        await saveWorldInfo(name, data);
    });
    automationIdInput.val(entry.automationId ?? '').trigger('input');
    setTimeout(() => createEntryInputAutocomplete(automationIdInput, getAutomationIdCallback(data)), 1);

    template.find('.inline-drawer-content').css('display', 'none'); //entries start collapsed

    function updatePosOrdDisplay(uid) {
        // display position/order info left of keyword box
        let entry = data.entries[uid];
        let posText = entry.position;
        switch (entry.position) {
            case 0:
                posText = '↑CD';
                break;
            case 1:
                posText = 'CD↓';
                break;
            case 2:
                posText = '↑AN';
                break;
            case 3:
                posText = 'AN↓';
                break;
            case 4:
                posText = `@D${entry.depth}`;
                break;
        }
        template.find('.world_entry_form_position_value').text(`(${posText} ${entry.order})`);
    }

    return template;
}
