/* 	
 Client-side logic for Wordpress CLI theme
 R. McFarland, 2006, 2007, 2008
 http://thrind.xamai.ca/
 
 jQuery rewrite and overhaul
 Chromakode, 2010
 http://www.chromakode.com/

 WordPress Rewrite and Overhaul
 BenBalter, 2012
 http://unix.benbalter.com
 
*/

//get jQuery out of no conflict
//@todo don't do this
var $ = jQuery;

/**** start from http://snippets.dzone.com/posts/show/701 ****/
// Removes leading whitespaces
function ltrim(value) {
	if (value) {
		var re = /\s*((\S+\s*)*)/;
		return value.replace(re, '$1');
	}
	return '';
}

// Removes ending whitespaces
function rtrim(value) {
	if (value) {
		var re = /((\s*\S+)*)\s*/;
		return value.replace(re, '$1');
	}
	return '';
}

// Removes leading and ending whitespaces
function trim(value) {
	if (value) {
		return ltrim(rtrim(value));
	}
	return '';
} /**** end from http://snippets.dzone.com/posts/show/701 ****/

function entityEncode(str) {
	str = str.replace(/&/g, '&amp;');
	str = str.replace(/</g, '&lt;');
	str = str.replace(/>/g, '&gt;');
	str = str.replace(/  /g, ' &nbsp;');
	if (/msie/i.test(navigator.userAgent)) {
		str = str.replace('\n', '&nbsp;<br />');
	} else {
		str = str.replace(/\x0D/g, '&nbsp;<br />');
	}
	return str;
}

var TerminalShell = {
	commands: {
		help: function help(terminal) {
			terminal.print($('<h3>' + wp_unix_i18n.help + '</h3>'));
			cmd_list = $('<ul>');
			$.each(this.commands, function(name, func) {
				cmd_list.append($('<li>').text(name));
			});
			terminal.print(cmd_list);
		}, 
		clear: function(terminal) {
			terminal.clear();
		},
		restart: function(terminal) {
		
			if ( this.sudo ) {
				TerminalShell.process( terminal, 'sudo shutdown' );
				setTimeout( function() { document.location.reload(); }, 1500 );
			} else {
				terminal.print( $('<p>').addClass('error').text( wp_unix_i18n.not_root ) );
			}
			
		},
		shutdown: function(terminal) {
		
			if ( this.sudo ) {
				username = terminal.config.prompt.split(':', 1 );
				terminal.print( wp_unix_i18n.broadcast_msg.replace( "%s", username[0] ) );
				terminal.print();
				terminal.print( wp_unix_i18n.going_down );
				$('#prompt, #cursor').hide();
				terminal.promptActive = false;
				$('#screen').delay( 1000 ).fadeOut( 'slow' );
			} else {
				terminal.print( $('<p>').addClass('error').text( wp_unix_i18n.not_root ) );
			}
			
		},
		sudo: function(terminal) {
			var cmd_args = Array.prototype.slice.call(arguments);
			cmd_args.shift(); // terminal
			if (cmd_args.join(' ') == wp_unix_i18n.sandwich ) {
				terminal.print('Okay.');
			} else {
				var cmd_name = cmd_args.shift();
				cmd_args.unshift(terminal);
				cmd_args.push('sudo');
				if (TerminalShell.commands.hasOwnProperty( cmd_name )) {
					this.sudo = true;
					this.commands[cmd_name].apply(this, cmd_args);
					delete this.sudo;
				} else if (!cmd_name) {
					terminal.print( wp_unix_i18n.sudo_what );
				} else {
					terminal.print('sudo: '+cmd_name+': '+wp_unix_i18n.command_not_found );
				}
			}
		},
		source: function( terminal) {
			terminal.print( $('<a>').attr('href','https://github.com/benbalter/wordpress-unix-theme').text('https://github.com/benbalter/wordpress-unix-theme') );
		}
	},
	filters: [],
	fallback: null,
	
	lastCommand: null,
	process: function(terminal, cmd) {
		try {
			$.each(this.filters, $.proxy(function(index, filter) {
				cmd = filter.call(this, terminal, cmd);
			}, this));
			var cmd_args = cmd.split(' ');
			var cmd_name = cmd_args.shift();
			cmd_args.unshift(terminal);
			if (this.commands.hasOwnProperty(cmd_name)) {
				this.commands[cmd_name].apply(this, cmd_args);
			} else {
				if (!(this.fallback && this.fallback(terminal, cmd))) {
					terminal.print( $('<p>').addClass('error').text( wp_unix_i18n.bad_command ) );
				}
			}
			this.lastCommand = cmd;
		} catch (e) {
			terminal.print($('<p>').addClass('error').text( wp_unix_i18n.error +': '+e));
			terminal.setWorking(false);
		}
	}
};

var Terminal = {
	buffer: '',
	pos: 0,
	history: [],
	historyPos: 0,
	promptActive: true,
	cursorBlinkState: true,
	_cursorBlinkTimeout: null,
	spinnerIndex: 0,
	_spinnerTimeout: null,
	_specialKeys: {17: 'ctrl', 18: 'alt', 145: 'scroll'},
	
	output: TerminalShell,
	
	config: {
		scrollStep:			20,
		scrollSpeed:		100,
		bg_color:			'#000',
		fg_color:			'#00FF44',
		cursor_blink_time:	700,
		cursor_style:		'block',
		prompt:				wp_unix_i18n.prompt,
		spinnerCharacters:	['[   ]','[.  ]','[.. ]','[...]'],
		spinnerSpeed:		250,
		typingSpeed:		25
	},
	
	sticky: {
		keys: {
			ctrl: false,
			alt: false,
			scroll: false
		},
		
		set: function(key, state) {
			this.keys[key] = state;
			$('#'+key+'-indicator').toggle(this.keys[key]);
		},
		
		toggle: function(key) {
			this.set(key, !this.keys[key]);
		},
		
		reset: function(key) {
			this.set(key, false);
		},
		
		resetAll: function(key) {
			$.each(this.keys, $.proxy(function(name, value) {
				this.reset(name);
			}, this));
		}
	},
	
	init: function() {
		function ifActive(func) {
			return function() {
				if (Terminal.promptActive) {
					func.apply(this, arguments);
				}
			};
		}

		$(document)
			.keypress($.proxy(ifActive(function(e) { 
				if (e.which >= 32 && e.which <= 126) {   
					var character = String.fromCharCode(e.which);
					var letter = character.toLowerCase();
				} else {
					return;
				}
				
				if ($.browser.opera && !(/[\w\s]/.test(character))) {
					return; // sigh.
				}
				
				if (this.sticky.keys.ctrl) {
					if (letter == 'w') {
						this.deleteWord();
					} else if (letter == 'h') {
						Terminal.deleteCharacter(false);
					} else if (letter == 'l') {
						this.clear();
					} else if (letter == 'a') {
						this.setPos(0);
					} else if (letter == 'e') {
						this.setPos(this.buffer.length);
					} else if (letter == 'd') {
						this.runCommand('logout');
					}
				} else {
					if (character) {
						this.addCharacter(character);
						e.preventDefault();
					}
				}
			}), this));
			$.hotkeys.add( 'return', ifActive(function(e) { Terminal.processInputBuffer(); }))
			$.hotkeys.add( 'enter', ifActive(function(e) { Terminal.processInputBuffer(); }))
			$.hotkeys.add( 'backspace', ifActive(function(e) { e.preventDefault();	Terminal.deleteCharacter(e.shiftKey); }))
			$.hotkeys.add( 'del', ifActive(function(e) { Terminal.deleteCharacter(true); }))
			$.hotkeys.add( 'left', ifActive(function(e) { Terminal.moveCursor(-1); }))
			$.hotkeys.add( 'right', ifActive(function(e) { Terminal.moveCursor(1); }))
			$.hotkeys.add( 'ctrl+up', ifActive(function(e) {
				e.preventDefault();
				Terminal.scrollPage(-1);
			}))		
			$.hotkeys.add( 'shift+up', ifActive(function(e) {
				e.preventDefault();
				Terminal.scrollLine(-1);
			}))	
			$.hotkeys.add( 'up', ifActive(function(e) {
				e.preventDefault();
				if (Terminal.sticky.keys.scroll) {
					Terminal.scrollLine(-1);
				} else if (Terminal.sticky.keys.ctrl) {
					Terminal.scrollPage(-1);
				} else {
					Terminal.moveHistory(-1);
				}
			}))
			$.hotkeys.add( 'down', ifActive(function(e) {
				e.preventDefault();
				if (Terminal.sticky.keys.scroll) {
					Terminal.scrollLine(1);
				} else if (Terminal.sticky.keys.ctrl) {
					Terminal.scrollPage(1);
				} else {
					Terminal.moveHistory(1);
				}
			}))
			$.hotkeys.add( 'shift+down', ifActive(function(e) {
				e.preventDefault();
				Terminal.scrollLine(1);
			}))			
			$.hotkeys.add( 'ctrl+down', ifActive(function(e) {
				e.preventDefault();
				Terminal.scrollPage(1);
			}))
			$.hotkeys.add( 'pageup', ifActive(function(e) { Terminal.scrollPage(-1); }))
			$.hotkeys.add( 'pagedown', ifActive(function(e) { Terminal.scrollPage(1); }))
			$.hotkeys.add( 'ctrl+home', ifActive(function(e) {
				e.preventDefault();
				Terminal.jumpToTop();
			}))
			$.hotkeys.add( 'home', ifActive(function(e) {
				e.preventDefault();
				if ( Terminal.sticky.keys.ctrl ) {
					Terminal.jumpToTop();
				} else {
					Terminal.setPos(0);
				}
			}))
			$.hotkeys.add( 'ctrl+end', ifActive(function(e) {
				e.preventDefault();
				Terminal.jumpToBottom();
			}));
			$.hotkeys.add( 'end', ifActive(function(e) {
				e.preventDefault();
				if (Terminal.sticky.keys.ctrl) {
					Terminal.jumpToBottom();
				} else {
					Terminal.setPos(Terminal.buffer.length);
				}
			}))
			$.hotkeys.add( 'tab', function(e) {
				e.preventDefault();
			});
			$(document).keyup(function(e) { 
				var keyName = Terminal._specialKeys[e.which];
				if (keyName in {'ctrl':true, 'alt':true, 'scroll':true}) {
					Terminal.sticky.toggle(keyName);
				} else if (!(keyName in {'left':true, 'right':true, 'up':true, 'down':true})) {
					Terminal.sticky.resetAll();
				}
			});
		
		$(window).resize(function(e) { $('#screen').scrollTop($('#screen').attr('scrollHeight')); });

		this.setCursorState(true);
		this.setWorking(false);
		$('#prompt').html(this.config.prompt);
		$('#screen').hide().fadeIn('fast', function() {
			$('#screen').triggerHandler('cli-load');
		});
	},
	
	setCursorState: function(state, fromTimeout) {
		this.cursorBlinkState = state;
		if (this.config.cursor_style == 'block') {
			if (state) {
				$('#cursor').css({color:this.config.bg_color, backgroundColor:this.config.fg_color});
			} else {
				$('#cursor').css({color:this.config.fg_color, background:'none'});
			}
		} else {
			if (state) {
				$('#cursor').css('textDecoration', 'underline');
			} else {
				$('#cursor').css('textDecoration', 'none');
			}
		}
		
		// (Re)schedule next blink.
		if (!fromTimeout && this._cursorBlinkTimeout) {
			window.clearTimeout(this._cursorBlinkTimeout);
			this._cursorBlinkTimeout = null;
		}
		this._cursorBlinkTimeout = window.setTimeout($.proxy(function() {
			this.setCursorState(!this.cursorBlinkState, true);
		},this), this.config.cursor_blink_time);
	},
	
	updateInputDisplay: function() {
		var left = '', underCursor = ' ', right = '';

		if (this.pos < 0) {
			this.pos = 0;
		}
		if (this.pos > this.buffer.length) {
			this.pos = this.buffer.length;
		}
		if (this.pos > 0) {
			left = this.buffer.substr(0, this.pos);
		}
		if (this.pos < this.buffer.length) {
			underCursor = this.buffer.substr(this.pos, 1);
		}
		if (this.buffer.length - this.pos > 1) {
			right = this.buffer.substr(this.pos + 1, this.buffer.length - this.pos - 1);
		}

		$('#lcommand').text(left);
		$('#cursor').text(underCursor);
		if (underCursor == ' ') {
			$('#cursor').html('&nbsp;');
		}
		$('#rcommand').text(right);
		$('#prompt').text(this.config.prompt);
		return;
	},
	
	clearInputBuffer: function() {
		this.buffer = '';
		this.pos = 0;
		this.updateInputDisplay();
	},
	
	clear: function() {
		$('#display').html('');
	},
	
	addCharacter: function(character) {
		var left = this.buffer.substr(0, this.pos);
		var right = this.buffer.substr(this.pos, this.buffer.length - this.pos);
		this.buffer = left + character + right;
		this.pos++;
		this.updateInputDisplay();
		this.setCursorState(true);
	},
	
	deleteCharacter: function(forward) {
		var offset = forward ? 1 : 0;
		if (this.pos >= (1 - offset)) {
			var left = this.buffer.substr(0, this.pos - 1 + offset);
			var right = this.buffer.substr(this.pos + offset, this.buffer.length - this.pos - offset);
			this.buffer = left + right;
			this.pos -= 1 - offset;
			this.updateInputDisplay();
		}
		this.setCursorState(true);
	},
	
	deleteWord: function() {
		if (this.pos > 0) {
			var ncp = this.pos;
			while (ncp > 0 && this.buffer.charAt(ncp) !== ' ') {
				ncp--;
			}
			left = this.buffer.substr(0, ncp - 1);
			right = this.buffer.substr(ncp, this.buffer.length - this.pos);
			this.buffer = left + right;
			this.pos = ncp;
			this.updateInputDisplay();
		}
		this.setCursorState(true);
	},
	
	moveCursor: function(val) {
		this.setPos(this.pos + val);
	},
	
	setPos: function(pos) {
		if ((pos >= 0) && (pos <= this.buffer.length)) {
			this.pos = pos;
			Terminal.updateInputDisplay();
		}
		this.setCursorState(true);
	},
	
	moveHistory: function(val) {
		var newpos = this.historyPos + val;
		if ((newpos >= 0) && (newpos <= this.history.length)) {
			if (newpos == this.history.length) {
				this.clearInputBuffer();
			} else {
				this.buffer = this.history[newpos];
			}
			this.pos = this.buffer.length;
			this.historyPos = newpos;
			this.updateInputDisplay();
			this.jumpToBottom();
		}
		this.setCursorState(true);
	},
	
	addHistory: function(cmd) {
		this.historyPos = this.history.push(cmd);
	},

	jumpToBottom: function() {
		$('#screen').scrollTop( $('#screen').prop('scrollHeight') );
	},

	jumpToTop: function() {
		$('#screen').scrollTop( 0 );
	},
	
	scrollPage: function(num) {
		$('#screen').scrollTop( $('#screen').scrollTop() + num * ($('#screen').height() * .75) );
	},

	scrollLine: function(num) {
		$('#screen').scrollTop( $('#screen').scrollTop() + num * this.config.scrollStep );
	},

	print: function(text) {

		if (!text) {
			$('#display').append($('<div>'));
		} else if( text instanceof jQuery ) {
			$('#display').append(text);
		} else {
			var av = Array.prototype.slice.call(arguments, 0);
			$('#display').append($('<p>').text(av.join(' ')));
		}
		this.jumpToBottom();
	},
	
	processInputBuffer: function(cmd) { 
		this.print($('<p>').addClass('command').text(this.config.prompt + this.buffer));
		var cmd = trim(this.buffer);
		this.clearInputBuffer();
		if (cmd.length == 0) {
			return false;
		}
		this.addHistory(cmd);
		if (this.output) {
			return this.output.process(this, cmd);
		} else {
			return false;
		}
	},
	
	setPromptActive: function(active) {
		this.promptActive = active;
		$('#inputline').toggle(this.promptActive);
	},
	
	setWorking: function(working) {
		if (working && !this._spinnerTimeout) {
			$('#display .command:last-child').add('#bottomline').first().append($('#spinner'));
			this._spinnerTimeout = window.setInterval($.proxy(function() {
				if (!$('#spinner').is(':visible')) {
					$('#spinner').fadeIn();
				}
				this.spinnerIndex = (this.spinnerIndex + 1) % this.config.spinnerCharacters.length;
				$('#spinner').text(this.config.spinnerCharacters[this.spinnerIndex]);
			},this), this.config.spinnerSpeed);
			this.setPromptActive(false);
			$('#screen').triggerHandler('cli-busy');
		} else if (!working && this._spinnerTimeout) {
			clearInterval(this._spinnerTimeout);
			this._spinnerTimeout = null;
			$('#spinner').fadeOut();
			this.setPromptActive(true);
			$('#screen').triggerHandler('cli-ready');
		}
	},
	
	runCommand: function(text) {
		var index = 0;
		var mine = false;
		
		this.promptActive = false;
		var interval = window.setInterval($.proxy(function typeCharacter() {
			if (index < text.length) {
				this.addCharacter(text.charAt(index));
				index += 1;
			} else {
				clearInterval(interval);
				this.promptActive = true;
				this.processInputBuffer();
			}
		}, this), this.config.typingSpeed);
	}
};

$(document).ready(function() {
	// Kill Opera's backspace keyboard action.
	document.onkeydown = document.onkeypress = function(e) { return $.hotkeys.special_keys[e.keyCode] != 'backspace'; };
	Terminal.init();
	
	$('#touch').focus( function() {	
		$(this).hide(); 
		$('.touchMsg').fadeOut();	
	});

});

//mobiel support
$('#screen').bind('cli-load', function() {

	//if this is a touch device, overlay a transparent input 
	// to pull up the software keyboard
	if ( Modernizr.touch ) {
		$('#touch').show();
		jQuery('<div>').addClass('touchMsg').text( wp_unix_i18n.touch_message ).appendTo('body');
	}

});